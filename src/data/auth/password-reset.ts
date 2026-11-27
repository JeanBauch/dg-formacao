import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { z } from "zod";
import { recordSecurityEvent } from "@/data/audit";
import { type ErrorLogger, loggable } from "./loggable";
import { requesterOf } from "./requester";

// Better Auth's routes of a password reset, named as its router names them:
// the request, which sends the e-mail with the link, and the completion, which
// sets the new password.
const requestRoute = "/request-password-reset";
const completionRoute = "/reset-password";

// A request for a password reset names the app's page its link sends the
// holder to (`redirectTo`), which Better Auth checks is of the app's own origin.
const destination = z.object({ redirectTo: z.string().min(1) });

// The e-mail a request asked the reset for, once Better Auth has validated it.
const requestedEmail = z.object({ email: z.string() });

// The password reset request's own hooks.
//
// A request without the destination is refused before anything is read, the
// same for an e-mail with or without an account (A3.5): without it, the link
// would end on Better Auth's own error page, which is disabled (A4.17).
//
// Each request Better Auth answers well counts in the security log, with the
// account when the e-mail has one and never the e-mail itself (A5.1). Better
// Auth answers both alike, so the row is written for both alike too.
export const passwordResetRequest = {
  id: "password-reset-request",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === requestRoute,
        handler: createAuthMiddleware(async (ctx) => {
          if (destination.safeParse(ctx.body).success) return;
          throw APIError.from("BAD_REQUEST", {
            code: "RESET_DESTINATION_REQUIRED",
            message:
              "Informe a página do app para onde o link de redefinição leva.",
          });
        }),
      },
    ],
    after: [
      {
        matcher: (ctx) => ctx.path === requestRoute,
        handler: createAuthMiddleware(async (ctx) => {
          // A refused request records nothing. `isAPIError` also knows the
          // refusal of a body that fails validation, which the router throws
          // with its own error class, not the one `APIError.from` makes.
          if (isAPIError(ctx.context.returned)) return;
          const { email } = requestedEmail.parse(ctx.body);
          try {
            const found =
              await ctx.context.internalAdapter.findUserByEmail(email);
            await recordSecurityEvent({
              event: "password_reset_requested",
              userId: found?.user.id ?? null,
              route: requestRoute,
              ...requesterOf(ctx.headers ?? ctx.request?.headers),
            });
          } catch (error) {
            // The request keeps its answer, the same with or without an
            // account (A3.5): the link has gone out already.
            ctx.context.logger.error(
              `Password reset request failed recording its security event: ${loggable(error)}`,
            );
          }
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

// What the follow-up of a password reset uses of Better Auth's context.
type ResetFollowUpContext = {
  internalAdapter: {
    deleteUserSessions(userId: string): Promise<unknown>;
    updateUser(userId: string, data: { emailVerified: true }): Promise<unknown>;
  };
  logger: ErrorLogger;
};

// Runs as Better Auth's `emailAndPassword.onPasswordReset`, with the request
// that completed the reset, once Better Auth has completed it: one
// transaction, now committed, spent the link, revoked the account's sessions
// and saved the new password.
//
// A sign-in with the old password that Better Auth checked before that commit
// can write its session after the transaction's revocation ran, so the
// sessions are revoked again, after the commit (A3.6). A session that such a
// sign-in writes later still goes: the sign-in checks its password again once
// its session exists, and by then finds the new one.
//
// Using the link proves the holder gets the e-mail sent to that address, so an
// e-mail not yet verified becomes verified (A3.13). The mark goes through
// Better Auth, never by a write of the app's own. The completion counts in the
// security log, with the account (A5.1).
//
// Nothing here throws: the password has changed already, and an error would
// answer the reset with a failure that did not happen. A mark that fails
// leaves the verification pending, for the confirmation's own flow.
export async function afterPasswordReset(
  context: Promise<ResetFollowUpContext>,
  { user }: { user: { id: string; emailVerified: boolean } },
  request: Request | undefined,
) {
  const { internalAdapter, logger } = await context;
  try {
    await internalAdapter.deleteUserSessions(user.id);
  } catch (error) {
    // The transaction's own revocation stands: only a session that a sign-in
    // wrote in the window above would stay.
    logger.error(
      `Password reset failed revoking the sessions again: ${loggable(error)}`,
    );
  }
  if (!user.emailVerified) {
    try {
      await internalAdapter.updateUser(user.id, { emailVerified: true });
    } catch (error) {
      // Only the failure's name and code reach the log: the failed query's
      // values could hold the e-mail (RNF-OBS-01).
      logger.error(
        `Password reset failed marking the e-mail verified: ${loggable(error)}`,
      );
    }
  }
  try {
    await recordSecurityEvent({
      event: "password_reset_completed",
      userId: user.id,
      route: completionRoute,
      ...requesterOf(request?.headers),
    });
  } catch (error) {
    // The failed query's values hold the full IP and the user agent
    // (RNF-SEG-15).
    logger.error(
      `Password reset failed recording its security event: ${loggable(error)}`,
    );
  }
}
