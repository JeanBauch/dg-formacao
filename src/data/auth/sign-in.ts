import "server-only";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordSecurityEvent } from "@/data/audit";
import { db } from "@/data/db/client";
import { user } from "@/data/db/schema";

// The client of a request, as it sent itself: its IP in the header Better
// Auth's rate limit reads (`x-forwarded-for`, its default), and its user agent.
// The IP goes whole to the security log, which keeps it and reduces it to its
// range itself; Better Auth's own reading would already cut an IPv6 address to
// its /64 (A5.11). A header with several addresses is not one IP, so the log
// keeps none, as Better Auth trusts none without trusted proxies.
function clientOf(headers: Headers | undefined) {
  return {
    ip: headers?.get("x-forwarded-for") ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}

// The e-mail a sign-in tried, once Better Auth has validated the request.
const signInRequest = z.object({ email: z.string() });

// The user with this e-mail, found the way the sign-in finds it, or null when
// the e-mail has no account.
async function userWithEmail(email: string) {
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
  const client = clientOf(ctx.headers ?? ctx.request?.headers);
  const signedIn = ctx.context.newSession;
  if (signedIn) {
    await recordSecurityEvent({
      event: "sign_in_succeeded",
      userId: signedIn.user.id,
      route: ctx.path,
      ...client,
    });
    return;
  }
  if (!refusedCredentials(ctx.context.returned)) return;
  const { email } = signInRequest.parse(ctx.body);
  await recordSecurityEvent({
    event: "sign_in_failed",
    reason: "invalid_credentials",
    userId: await userWithEmail(email),
    route: ctx.path,
    ...client,
  });
});
