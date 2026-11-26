import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/data/db/client";
import { user } from "@/data/db/schema";
import { verifySession } from "./session";

// The account of the request's session, as the account's page shows it: the
// holder's name and e-mail, and whether the e-mail is confirmed. Null without
// a session. The query reads only the session's own user.
export const currentAccount = cache(async () => {
  const session = await verifySession();
  if (session === null) return null;
  const [account] = await db
    .select({
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, session.userId));
  return account ?? null;
});
