import { securityEvents } from "@/data/db/schema";

declare const db: {
  query: { securityEvents: { findMany(): Promise<unknown[]> } };
};

// Four ways a use case outside the audit module could read the security log:
// the table, its relational query, and its name in raw SQL, as a template or
// as a string.
export const reads = [
  securityEvents.name,
  db.query.securityEvents.findMany(),
  `select ip from app.security_events`,
  "select user_agent from app.security_events",
];
