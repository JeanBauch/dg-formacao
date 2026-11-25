import "server-only";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordSecurityEvent } from "@/data/audit";
import { db } from "@/data/db/client";
import { user } from "@/data/db/schema";
import { clientOf } from "./client";
import { loggable } from "./loggable";

// The e-mail a sign-in tried, once Better Auth has validated the request.
const signInRequest = z.object({ email: z.string() });

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

// Runs as Better Auth's `hooks.after`: each sign-in with e-mail and password
// counts in the security log (A5.1). A failed one names the account when the
// e-mail has one, and never keeps the e-mail it tried (A5.9).
export const recordSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email") return;
  const signedIn = ctx.context.newSession;
  if (!signedIn && !refusedCredentials(ctx.context.returned)) return;
  const client = clientOf(ctx.headers ?? ctx.request?.headers);
  try {
    await recordSecurityEvent(
      signedIn
        ? {
            event: "sign_in_succeeded",
            userId: signedIn.user.id,
            route: ctx.path,
            ...client,
          }
        : {
            event: "sign_in_failed",
            reason: "invalid_credentials",
            userId: await userIdWithEmail(signInRequest.parse(ctx.body).email),
            route: ctx.path,
            ...client,
          },
    );
  } catch (error) {
    // A sign-in leaves one session and one occurrence, or neither (NF-2): the
    // session it created goes, and so does the cookie the answer already
    // carries. A session whose deletion fails too expires on its own.
    let outcome = "";
    if (signedIn) {
      outcome = "; the new session was deleted";
      try {
        await ctx.context.internalAdapter.deleteSession(signedIn.session.token);
      } catch (deletionError) {
        outcome = `; deleting the new session failed too: ${loggable(deletionError)}`;
      }
      ctx.context.responseHeaders?.delete("set-cookie");
    }
    // Only the failure's name and code reach the log: the failed query's values
    // hold the full IP, the user agent and, for a refused sign-in, the e-mail
    // it tried (RNF-SEG-15, RNF-OBS-01).
    ctx.context.logger.error(
      `Sign-in failed recording its security event: ${loggable(error)}${outcome}`,
    );
    // No cause, which a log of the error would print whole. A refused sign-in
    // keeps the status of its refusal, as Better Auth answers an after-hook's
    // error with the endpoint's status.
    throw APIError.from("INTERNAL_SERVER_ERROR", {
      code: "SIGN_IN_FAILED",
      message: "Não foi possível entrar. Tente de novo.",
    });
  }
});
