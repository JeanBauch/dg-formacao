import { randomUUID } from "node:crypto";
import { signUp } from "./sign-up";

// The staff roles (Papel, GLOSSARY.md), as the admin plugin keeps them in the
// user's role field.
export type StaffRole = "instructor" | "admin";

// A password long enough for a staff user: 12 characters or more
// (RF-AUT-08).
export const staffPassword = "senha-da-equipe-1";

// A staff user with this role, one per staff role in the tests (seams 1 and
// 2), and no session. A fictitious person signs up over HTTP, with an e-mail of
// a domain reserved for documentation, so the user has the holder's profile,
// the consents and a password login identity, as an invited person has once
// they have set the password and accepted (A4.2, A4.15). Better Auth's own
// adapter then gives the user the role, which no HTTP route sets (A4.17), and
// ends the session the sign-up opened. Auth is loaded here, not at the top,
// because it loads the session gate, which loads the request helper in place
// of `next/headers`.
export async function staffUser(
  role: StaffRole,
  { password = staffPassword }: { password?: string } = {},
) {
  const { auth } = await import("@/data/auth");
  const email = `equipe-${randomUUID()}@example.com`;
  const { userId } = await signUp(email, password);
  const { internalAdapter } = await auth.$context;
  await internalAdapter.updateUser(userId, { role });
  await internalAdapter.deleteUserSessions(userId);
  return { email, userId, password };
}
