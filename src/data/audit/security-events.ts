import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/data/db/client";
import { securityEvents } from "@/data/db/schema";
import { type SecurityEvent, securityEventRow } from "@/domain/audit";

// Records one occurrence of a security event (RNF-SEG-15). The occurrences
// with the same key share one row, and the database counts them: the unique
// index on the key makes two simultaneous occurrences one row (A5.10). The row
// keeps the earliest and the latest time of its occurrences, whatever order
// their inserts reach the database in. The IP, the user agent and the details
// stay those of the occurrence that created the row.
export async function recordSecurityEvent(occurrence: SecurityEvent) {
  await db
    .insert(securityEvents)
    .values(securityEventRow(occurrence, new Date()))
    .onConflictDoUpdate({
      target: securityEvents.dedupeKey,
      set: {
        count: sql`${securityEvents.count} + 1`,
        firstAt: sql`least(${securityEvents.firstAt}, excluded.first_at)`,
        lastAt: sql`greatest(${securityEvents.lastAt}, excluded.last_at)`,
      },
    });
}
