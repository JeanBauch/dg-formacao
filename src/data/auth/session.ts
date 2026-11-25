import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

// The roles of an account, as the admin plugin keeps them in the user's role
// field: one value, or several separated by commas. An account with no staff
// role has the plugin's default, user.
function rolesOf(role: string | null | undefined) {
  return (role ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");
}

// The session gate (ADR-008): the session of the request's cookie, read from
// the database, or null when there is none or it is no longer valid. Every
// data function, Server Action and Route Handler that serves private data
// starts here, and denies when it gets null. The roles come from the account
// as the database has them now, not as they were when the session began.
// React's cache scopes it to one request, so the components of a page that all
// ask for the session make one read of it (NF-1).
export const verifySession = cache(async () => {
  const found = await auth.api.getSession({ headers: await headers() });
  if (found === null) return null;
  return {
    userId: found.user.id,
    roles: rolesOf(found.user.role),
    emailVerified: found.user.emailVerified,
    sessionId: found.session.id,
    sessionCreatedAt: found.session.createdAt,
  };
});
