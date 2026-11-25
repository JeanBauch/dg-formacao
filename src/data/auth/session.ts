import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { rolesOf } from "@/domain/auth";
import { auth } from "./auth";

// The session gate (ADR-008): the session of the request's cookie, read from
// the database, or null when there is none or it is no longer valid. Every
// data function, Server Action and Route Handler that serves private data
// starts here, and denies when it gets null. The roles come from the account
// as the database has them now, not as they were when the session began.
// React's cache scopes it to one request, so the components of a page that all
// ask for the session make one read of it (NF-1).
//
// The gate reads the session without renewing it. A Server Component cannot
// set the cookie, so a renewal here would move the session's expiry in the
// database while the browser kept the old cookie, and use up the day's renewal.
// The daily renewal (A2.7) happens on the HTTP read of the session, which
// writes the cookie too.
export const verifySession = cache(async () => {
  const found = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  if (found === null) return null;
  return {
    userId: found.user.id,
    roles: rolesOf(found.user.role),
    emailVerified: found.user.emailVerified,
    sessionId: found.session.id,
    sessionCreatedAt: found.session.createdAt,
  };
});
