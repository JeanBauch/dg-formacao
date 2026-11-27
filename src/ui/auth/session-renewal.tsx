"use client";

import { useEffect } from "react";
import { answerOf, authClient } from "./auth-client";

// Reads the session over Better Auth's HTTP once per load of the private area:
// when the private area's layout mounts in the browser, not on each private
// page, as a client-side navigation between two private pages keeps the layout
// mounted. The R0 has a single private page; the ticket that adds a second one
// must revisit this. A page rendered on the server sets no cookie, and the
// session gate reads without renewing, so this read is the one that renews a
// remembered session on its first use of the day, in the database and in the
// cookie (A2.7). A session that is not remembered is never renewed, and its
// cookie keeps no expiry. A read that fails leaves the session as it was, and
// the next load of the private area reads it again, so its answer goes unused.
export function SessionRenewal() {
  useEffect(() => {
    void answerOf(authClient.getSession());
  }, []);
  return null;
}
