import "server-only";
import { type AuthContext, BASE_ERROR_CODES } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordSecurityEvent } from "@/data/audit";
import { db } from "@/data/db/client";
import { user } from "@/data/db/schema";
import { loggable } from "./loggable";
import { requesterOf } from "./requester";

// What a sign-in sent, once Better Auth has validated the request.
const signInRequest = z.object({ email: z.string(), password: z.string() });

// The id of the user with this e-mail, found the way the sign-in finds it, or
// null when the e-mail has no account.
async function userIdWithEmail(email: string) {
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return found?.id ?? null;
}

// Whether a sign-in was refused for a wrong e-mail or password: Better Auth
// answers both with the same error (A2.10).
function refusedCredentials(returned: unknown) {
  return (
    returned instanceof APIError &&
    returned.body?.code === "INVALID_EMAIL_OR_PASSWORD"
  );
}

// Whether this password opens the account as its login identity has it now,
// checked the way Better Auth's sign-in checks it.
async function opensTheAccountNow(
  { internalAdapter, password: passwords }: AuthContext,
  userId: string,
  password: string,
) {
  const identity = await internalAdapter.findCredentialAccount(userId);
  if (!identity?.password) return false;
  return passwords.verify({ hash: identity.password, password });
}

// Runs as Better Auth's `hooks.after`, after each sign-in with e-mail and
// password.
//
// Better Auth's sign-in reads the password, checks it, and only then writes
// the session, so a password reset that commits in between leaves a session
// opened by the old password, which the reset's revocation never saw. Once the
// session exists, the password the sign-in sent is checked again: when it no
// longer opens the account, the session goes and the sign-in is refused as a
// wrong password is (A3.6). A check that still finds the old password ran
// before the reset committed, and the reset deletes the sessions again after
// its commit, this one among them.
//
// Each sign-in counts in the security log (A5.1). A failed one names the
// account when the e-mail has one, and never keeps the e-mail it tried (A5.9).
export const afterSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email") return;
  const created = ctx.context.newSession;
  if (!created && !refusedCredentials(ctx.context.returned)) return;
  const { email, password } = signInRequest.parse(ctx.body);

  // A sign-in leaves one session and one occurrence, or neither (NF-2): on a
  // failure along the way, the session it created goes, and so does the cookie
  // the answer already carries. A session whose deletion fails too expires on
  // its own. Only the failure's name and code reach the log: the failed
  // query's values hold the full IP, the user agent and, for a refused
  // sign-in, the e-mail it tried (RNF-SEG-15, RNF-OBS-01).
  const failure = async (step: string, error: unknown) => {
    let outcome = "";
    if (created) {
      outcome = "; the new session was deleted";
      try {
        await ctx.context.internalAdapter.deleteSession(created.session.token);
      } catch (deletionError) {
        outcome = `; deleting the new session failed too: ${loggable(deletionError)}`;
      }
      ctx.context.responseHeaders?.delete("set-cookie");
    }
    ctx.context.logger.error(
      `Sign-in failed ${step}: ${loggable(error)}${outcome}`,
    );
    // No cause, which a log of the error would print whole. A refused sign-in
    // keeps the status of its refusal, as Better Auth answers an after-hook's
    // error with the endpoint's status.
    return APIError.from("INTERNAL_SERVER_ERROR", {
      code: "SIGN_IN_FAILED",
      message: "Não foi possível entrar. Tente de novo.",
    });
  };

  let signedIn = created;
  try {
    if (
      created &&
      !(await opensTheAccountNow(ctx.context, created.user.id, password))
    ) {
      signedIn = null;
      await ctx.context.internalAdapter.deleteSession(created.session.token);
      ctx.context.responseHeaders?.delete("set-cookie");
    }
  } catch (error) {
    throw await failure("checking its password again", error);
  }

  try {
    const requester = requesterOf(ctx.headers ?? ctx.request?.headers);
    await recordSecurityEvent(
      signedIn
        ? {
            event: "sign_in_succeeded",
            userId: signedIn.user.id,
            route: ctx.path,
            ...requester,
          }
        : {
            event: "sign_in_failed",
            reason: "invalid_credentials",
            userId: created?.user.id ?? (await userIdWithEmail(email)),
            route: ctx.path,
            ...requester,
          },
    );
  } catch (error) {
    throw await failure("recording its security event", error);
  }

  // Refused with a wrong password's answer (A2.10). The endpoint itself
  // succeeded, so Better Auth answers with this error's own status.
  if (created && !signedIn)
    throw APIError.from(
      "UNAUTHORIZED",
      BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
    );
});
