import "server-only";
import { type AuthContext, BASE_ERROR_CODES } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";
import { recordSecurityEvent } from "@/data/audit";
import { isStaffRole } from "@/domain/audit";
import { lockStartedBy, staffPasswordMinLength } from "@/domain/auth";
import { loggable } from "./loggable";
import { requesterOf } from "./requester";
import { clearFailedSignIns, countFailedSignIn } from "./sign-in-lockout";

// What a sign-in sent, once Better Auth has validated the request.
const signInRequest = z.object({ email: z.string(), password: z.string() });

// The role field the admin plugin adds to the user, which Better Auth's own
// types leave out.
const userWithRole = z.object({ role: z.string().nullish() });

function roleOf(signedInUser: unknown) {
  return userWithRole.parse(signedInUser).role ?? null;
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

  // A staff account by the role the sign-in has just read with the account,
  // so a role changed since is already in force (A4.13).
  const staff = created !== null && isStaffRole(roleOf(created.user));

  // Why the sign-in is refused, or null when it signs in. Once its session
  // exists, the sign-in is refused when its password no longer opens the
  // account, or when it opens a staff account with fewer than 12 characters:
  // its person sets a new password first (A4.11). That check runs only after
  // the password is verified, so it reveals nothing to whoever does not know
  // it. Either way the session goes, and so does its cookie.
  let refusal: "invalid_credentials" | "staff_password_too_short" | null =
    created ? null : "invalid_credentials";
  if (created) {
    try {
      if (!(await opensTheAccountNow(ctx.context, created.user.id, password)))
        refusal = "invalid_credentials";
      else if (staff && password.length < staffPasswordMinLength)
        refusal = "staff_password_too_short";
      if (refusal !== null) {
        await ctx.context.internalAdapter.deleteSession(created.session.token);
        ctx.context.responseHeaders?.delete("set-cookie");
      }
    } catch (error) {
      throw await failure("checking its password again", error);
    }
  }
  const signedIn = refusal === null ? created : null;

  // A wrong password counts toward the account's lockout (A2.15), and names
  // the account in the security log when the e-mail has one. A sign-in that
  // succeeds counts the failures from zero again (A2.17). A staff password too
  // short does neither: it was the right one (A4.11).
  let failed = null;
  try {
    if (signedIn) await clearFailedSignIns(signedIn.user.id);
    else if (refusal === "invalid_credentials")
      failed = await countFailedSignIn(email);
  } catch (error) {
    throw await failure("updating its account's failed sign-ins", error);
  }

  try {
    const requester = requesterOf(ctx.headers ?? ctx.request?.headers);
    if (signedIn)
      await recordSecurityEvent({
        event: staff ? "staff_sign_in_succeeded" : "sign_in_succeeded",
        userId: signedIn.user.id,
        route: ctx.path,
        ...requester,
      });
    else if (refusal !== null)
      await recordSecurityEvent({
        event: "sign_in_failed",
        reason: refusal,
        userId: failed?.userId ?? created?.user.id ?? null,
        route: ctx.path,
        ...requester,
      });
    // Only the failure that starts a lock records it, by the count it got
    // back (A5.1). An attempt refused during the lock never gets this far.
    const lockMinutes = failed && lockStartedBy(failed.failures);
    if (failed && lockMinutes)
      await recordSecurityEvent({
        event: "account_locked",
        lockMinutes,
        userId: failed.userId,
        route: ctx.path,
        ...requester,
      });
  } catch (error) {
    throw await failure("recording its security event", error);
  }

  // The endpoint itself succeeded, so Better Auth answers with each error's
  // own status: a staff password too short sends its person to set a new one
  // (A4.11), and any other refusal is a wrong password's answer (A2.10).
  if (refusal === "staff_password_too_short")
    throw APIError.from("FORBIDDEN", {
      code: "STAFF_PASSWORD_TOO_SHORT",
      message: `Defina uma senha nova, com pelo menos ${staffPasswordMinLength} caracteres, em "Esqueci minha senha".`,
    });
  if (created && !signedIn)
    throw APIError.from(
      "UNAUTHORIZED",
      BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
    );
});
