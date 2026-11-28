import { randomUUID } from "node:crypto";
import { testBaseUrl } from "./base-url";
import { nextTestIp } from "./ip";

// The staff roles (Papel, GLOSSARY.md), as the admin plugin keeps them in the
// user's role field.
export type StaffRole = "instructor" | "admin";

// A password long enough for a staff account: 12 characters or more
// (RF-AUT-08).
export const staffPassword = "senha-da-equipe-1";

// A staff account with this role, one per staff role in the tests (seams 1 and
// 2), and no session. A fictitious person signs up over HTTP, with an e-mail of
// a domain reserved for documentation, so the account has the holder's
// profile, the consents and a password login identity, as an invited account
// has once its person has set the password and accepted (A4.2, A4.15). Better
// Auth's own adapter then gives it the role, which no HTTP route sets (A4.17),
// and ends the session the sign-up opened. Auth is loaded here, not at the top,
// because it loads the session gate, which loads the request helper in place
// of `next/headers`.
export async function staffAccount(
  role: StaffRole,
  { password = staffPassword }: { password?: string } = {},
) {
  const { auth } = await import("@/data/auth");
  const email = `equipe-${randomUUID()}@example.com`;
  const response = await auth.handler(
    new Request(`${testBaseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": nextTestIp(),
      },
      body: JSON.stringify({
        name: "Pessoa Fictícia da Equipe",
        email,
        password,
        adultDeclaration: true,
        acceptance: true,
      }),
    }),
  );
  if (!response.ok) {
    throw new Error(
      `The staff account's sign-up failed with ${response.status}`,
    );
  }
  const { user } = (await response.json()) as { user: { id: string } };
  const { internalAdapter } = await auth.$context;
  await internalAdapter.updateUser(user.id, { role });
  await internalAdapter.deleteUserSessions(user.id);
  return { email, userId: user.id, password };
}
