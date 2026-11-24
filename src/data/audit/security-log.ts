import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/data/db/client";
import { securityEvents } from "@/data/db/schema";
import { type SecurityEvent, securityLogRow } from "@/domain/audit";

// Records one occurrence of a security event (RNF-SEG-15). The occurrences
// with the same key share one row, and the database counts them: the unique
// index on the key makes two simultaneous occurrences one row (A5.10). The row
// keeps its first occurrence's values and the latest time.
export async function recordSecurityEvent(occurrence: SecurityEvent) {
  await db
    .insert(securityEvents)
    .values(securityLogRow(occurrence, new Date()))
    .onConflictDoUpdate({
      target: securityEvents.dedupeKey,
      set: {
        count: sql`${securityEvents.count} + 1`,
        lastAt: sql`greatest(${securityEvents.lastAt}, excluded.last_at)`,
      },
    });
}
