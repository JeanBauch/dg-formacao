import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/data/db/client";
import { signInFailures, user } from "@/data/db/schema";
import { isSignInLocked } from "@/domain/auth";

// The e-mail a sign-in tried. A before-hook runs before Better Auth validates
// the body, so a body without it is left to Better Auth's own refusal.
const triedEmail = z.object({ email: z.string() });

// The failed sign-ins in a row of the account with this e-mail, found the way
// the sign-in finds the account, or null when it has none or no account.
async function failuresOf(email: string) {
  const [found] = await db
    .select({
      failures: signInFailures.failures,
      lastFailedAt: signInFailures.lastFailedAt,
    })
    .from(signInFailures)
    .innerJoin(user, eq(user.id, signInFailures.userId))
    .where(eq(user.email, email.toLowerCase()));
  return found ?? null;
}

// The lockout's own hook (RF-AUT-05). A sign-in to a locked account is refused
// before Better Auth reads the account, so no password is checked: an attack
// on a locked account spends no hash, slow on purpose and costly on the
// host's CPU (A2.16, NF-7). The answer is the same with the right password and
// a wrong one, and the attempt counts as no failure.
export const signInLockout = {
  id: "sign-in-lockout",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const tried = triedEmail.safeParse(ctx.body);
          if (!tried.success) return;
          const failures = await failuresOf(tried.data.email);
          if (failures === null || !isSignInLocked(failures, new Date()))
            return;
          throw APIError.from("TOO_MANY_REQUESTS", {
            code: "ACCOUNT_LOCKED",
            message:
              "Muitas tentativas; tente de novo em alguns minutos ou redefina a senha.",
          });
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

// An account's failed sign-ins in a row, once one more has counted.
type FailedSignIn = { userId: string; failures: number };

// Counts one more failed sign-in in a row for the account with this e-mail,
// and returns the account and its failures in a row now, or null when the
// e-mail has no account. One statement adds the failure and returns the count,
// so failures that arrive at the same time each count (A2.18).
export async function countFailedSignIn(
  email: string,
): Promise<FailedSignIn | null> {
  const at = new Date().toISOString();
  const [counted] = await db
    .insert(signInFailures)
    .select(
      db
        .select({
          userId: user.id,
          failures: sql<number>`1`.as("failures"),
          lastFailedAt: sql<Date>`${at}::timestamptz`.as("last_failed_at"),
        })
        .from(user)
        .where(eq(user.email, email.toLowerCase())),
    )
    .onConflictDoUpdate({
      target: signInFailures.userId,
      set: {
        failures: sql`${signInFailures.failures} + 1`,
        lastFailedAt: sql`greatest(${signInFailures.lastFailedAt}, excluded.last_failed_at)`,
      },
    })
    .returning({
      userId: signInFailures.userId,
      failures: signInFailures.failures,
    });
  return counted ?? null;
}

// Counts the account's failed sign-ins from zero again, once a sign-in
// succeeds or its password is reset: the next lock is the first one (A2.17).
export async function clearFailedSignIns(userId: string) {
  await db.delete(signInFailures).where(eq(signInFailures.userId, userId));
}
