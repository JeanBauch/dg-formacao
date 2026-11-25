import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/data/db/client";
import { securityEvents, user } from "@/data/db/schema";
import {
  isOutsideCap,
  isStaffRole,
  overflowKeyPrefix,
  overflowRow,
  type SecurityEvent,
  securityEventRow,
} from "@/domain/audit";
import { env } from "@/env";
import { consoleTelemetry, type Telemetry } from "@/infra/telemetry";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Adds one occurrence to the row with its key, which the database counts: the
// unique index on the key makes two simultaneous occurrences one row (A5.10).
// The row keeps the earliest and the latest time of its occurrences, whatever
// order their inserts reach the database in. The IP, the user agent and the
// details stay those of the occurrence that created the row.
async function addToRow(
  row: ReturnType<typeof securityEventRow>,
  executor: Transaction | typeof db = db,
) {
  await executor
    .insert(securityEvents)
    .values(row)
    .onConflictDoUpdate({
      target: securityEvents.dedupeKey,
      set: {
        count: sql`${securityEvents.count} + 1`,
        firstAt: sql`least(${securityEvents.firstAt}, excluded.first_at)`,
        lastAt: sql`greatest(${securityEvents.lastAt}, excluded.last_at)`,
      },
    });
}

// The UTC day of an instant, as in 2026-11-24.
function utcDay(at: Date) {
  return at.toISOString().slice(0, 10);
}

// The rows created in the UTC day of this instant, and how many of them are
// overflow rows.
async function rowsOfTheDay(at: Date, executor: Transaction | typeof db = db) {
  const start = new Date(`${utcDay(at)}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const [day] = await executor
    .select({
      rows: sql<number>`count(*)`.mapWith(Number),
      // The prefix holds no LIKE wildcard, so it matches as it is written.
      overflowRows:
        sql<number>`count(*) filter (where ${securityEvents.dedupeKey} like ${`${overflowKeyPrefix}%`})`.mapWith(
          Number,
        ),
    })
    .from(securityEvents)
    .where(
      and(gte(securityEvents.firstAt, start), lt(securityEvents.firstAt, end)),
    );
  return day;
}

// Whether a row with this key exists.
async function rowExists(dedupeKey: string) {
  const found = await db
    .select({ id: securityEvents.id })
    .from(securityEvents)
    .where(eq(securityEvents.dedupeKey, dedupeKey))
    .limit(1);
  return found.length > 0;
}

// Whether the account is a staff account, by the role it has now. An account
// that does not exist, or no account, is not.
async function holdsStaffRole(userId: string | null) {
  if (userId === null) return false;
  const [found] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  return found !== undefined && isStaffRole(found.role);
}

// The overflow row an occurrence goes to, or null when it is recorded in its own
// row: below the cap, outside it, or summing to a row that exists (A5.14). It
// also says whether the day already had an overflow row.
//
// The cap is read with no transaction and no row lock, on purpose: A5.14 makes
// it approximate, so simultaneous occurrences at the edge may create a few rows
// above it, and a busy log writes with no lock. Only the day's first overflow,
// and so its warning, is decided under a lock (addToFirstOverflow).
async function overflowFor(
  occurrence: SecurityEvent,
  row: ReturnType<typeof securityEventRow>,
  at: Date,
) {
  // The events that stay outside the cap of any account need no query.
  if (isOutsideCap(occurrence.event, false)) return null;
  const day = await rowsOfTheDay(at);
  if (day.rows < env.SECURITY_EVENTS_DAILY_CAP) return null;
  if (await rowExists(row.dedupeKey)) return null;
  const staff = await holdsStaffRole(occurrence.userId);
  if (isOutsideCap(occurrence.event, staff)) return null;
  return {
    row: overflowRow(occurrence, at, staff),
    dayHadOverflow: day.overflowRows > 0,
  };
}

// Adds an occurrence to an overflow row when the day had none at the first
// read, and says whether it was the day's first. Simultaneous occurrences can
// all have read none, so they take turns under a lock of the UTC day, and each
// counts the day's overflow rows again under it: only the one that still finds
// none is the first. The count is a statement after the lock, so in Postgres's
// default isolation, read committed, it sees the rows that the previous turns
// committed. The lock is the transaction's, which the transaction pooler keeps
// on one connection, and it ends with the commit (A5.14).
async function addToFirstOverflow(
  row: ReturnType<typeof overflowRow>,
  at: Date,
) {
  return db.transaction(async (tx) => {
    const lock = `security-log-daily-cap:${utcDay(at)}`;
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${lock}, 0))`,
    );
    const day = await rowsOfTheDay(at, tx);
    await addToRow(row, tx);
    return day.overflowRows === 0;
  });
}

// Records one occurrence of a security event (RNF-SEG-15). The occurrences
// with the same key share one row. Once the day's cap of new rows is reached, an
// occurrence that would create a row counts in an overflow row instead, and the
// first one of the day warns the team through the telemetry, once the day
// (A5.14). Once the day has an overflow row, the occurrences write it with no
// lock.
export async function recordSecurityEvent(
  occurrence: SecurityEvent,
  telemetry: Telemetry = consoleTelemetry,
) {
  const at = new Date();
  const row = securityEventRow(occurrence, at);
  const overflow = await overflowFor(occurrence, row, at);
  if (overflow === null) return addToRow(row);
  if (overflow.dayHadOverflow) return addToRow(overflow.row);
  if (await addToFirstOverflow(overflow.row, at)) {
    // Only the day: the cap comes from the environment, which stays out of the
    // log, and whoever reads the warning has the configuration.
    telemetry.warn("security-log-daily-cap-reached", { day: utcDay(at) });
  }
}
