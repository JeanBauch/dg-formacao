"use client";

import { useEffect } from "react";
import { answerOf, authClient } from "./auth-client";

// Reads the session over Better Auth's HTTP once a private page is open in the
// browser. A page rendered on the server sets no cookie, and the session gate
// reads without renewing, so this read is the one that renews a remembered
// session on its first use of the day, in the database and in the cookie
// (A2.7). A session that is not remembered is never renewed, and its cookie
// keeps no expiry. A read that fails leaves the session as it was, and the
// next private page reads it again, so its answer goes unused.
export function SessionRenewal() {
  useEffect(() => {
    void answerOf(authClient.getSession());
  }, []);
  return null;
}
