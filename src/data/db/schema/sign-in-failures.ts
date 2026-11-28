import { integer, text, timestamp } from "drizzle-orm/pg-core";
import { app } from "./app";
import { user } from "./auth";

// The failed sign-ins in a row of each account, the auth module's lockout
// counter (RF-AUT-05): a row from the account's first failure, gone once a
// sign-in succeeds or the password is reset (A2.17). It lives in the database,
// never in memory, as each serverless instance has its own memory.
export const signInFailures = app.table("sign_in_failures", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // How many sign-ins in a row failed.
  failures: integer("failures").notNull(),
  // When the latest of them failed, which a lockout counts from.
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }).notNull(),
});
