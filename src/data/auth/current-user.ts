import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/data/db/client";
import { user } from "@/data/db/schema";
import { verifySession } from "./session";

// The user of the request's session, as the user's page (/conta) shows it: the
// holder's name and e-mail, and whether the e-mail is confirmed. Null without
// a session. The query reads only the session's own user.
export const currentUser = cache(async () => {
  const session = await verifySession();
  if (session === null) return null;
  const [found] = await db
    .select({
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, session.userId));
  return found ?? null;
});
