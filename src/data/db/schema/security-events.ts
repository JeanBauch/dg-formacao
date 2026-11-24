import {
  index,
  inet,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { securityEventTypes, userAgentMaxLength } from "@/domain/audit";
import { app } from "./app";

// The kinds of event, a closed enum of the database (A5.1).
export const securityEventType = app.enum("security_event", securityEventTypes);

// The security log (registro de segurança, RNF-SEG-15), the only place that
// keeps the client's IP. Only the audit module writes it (A5.6). Its writer
// also reads it, for the daily cap only (A5.14), and nothing else reads it but
// the purge. The user is kept without a foreign key, so a deleted user's rows
// stay until the end of the retention period (A2.14).
export const securityEvents = app.table(
  "security_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    event: securityEventType("event").notNull(),
    userId: text("user_id"),
    ip: inet("ip"),
    userAgent: varchar("user_agent", { length: userAgentMaxLength }),
    route: text("route").notNull(),
    details: jsonb("details"),
    count: integer("count").notNull().default(1),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
  },
  (table) => [
    // The purge deletes by time (A5.7).
    index("security_events_first_at_idx").on(table.firstAt),
    uniqueIndex("security_events_dedupe_key_idx").on(table.dedupeKey),
  ],
);
