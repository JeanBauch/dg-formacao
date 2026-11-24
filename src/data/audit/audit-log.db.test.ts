import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { recordAuditEntry } from "@/data/audit";
import { db } from "@/data/db/client";
import type { AuditEntry } from "@/domain/audit";
import { columnTypes } from "@/test/db/column-types";
import { connect, testDatabase } from "@/test/db/test-database";

// Seam 2: the audit module's public interface, over the test database, as the
// application role. Every staff write records its audit row in its own
// transaction, so each one here runs in a transaction too. This file reads the
// rows and cleans up as the migrations role: the application role cannot
// delete audit rows (A1.12).
const owner = connect(testDatabase.migrationsUrl);

beforeEach(async () => {
  await owner`truncate app.audit_log`;
});

afterAll(async () => {
  await owner.end();
});

function record(entry: AuditEntry) {
  return db.transaction((tx) => recordAuditEntry(tx, entry));
}

type StoredEntry = {
  actor_user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  diff: unknown;
  created_at: Date;
};

function storedEntries() {
  return owner<StoredEntry[]>`
    select actor_user_id, action, entity, entity_id, diff, created_at
    from app.audit_log order by created_at, id`;
}

describe("an audit row (RNF-OBS-10)", () => {
  test("records who did what to which entity, before and after, and when", async () => {
    const admin = uuidv7();
    const invited = uuidv7();
    const sent = Date.now();

    await record({
      actorUserId: admin,
      action: "staff_invited",
      entity: "user",
      entityId: invited,
      before: null,
      after: { role: "instructor", banned: false },
    });

    const [entry] = await storedEntries();
    expect(entry).toMatchObject({
      actor_user_id: admin,
      action: "staff_invited",
      entity: "user",
      entity_id: invited,
      diff: { before: null, after: { role: "instructor", banned: false } },
    });
    // The time of the write, give or take the clocks of the host and the
    // database container.
    expect(Math.abs(entry.created_at.getTime() - sent)).toBeLessThan(10_000);
  });

  test("keeps the actor in the type of the user's ID, text (A2.6)", async () => {
    // The type of the user's ID that A2.6 recorded.
    expect(await columnTypes(owner, 'app."user"')).toMatchObject({
      id: "text",
    });
    expect(await columnTypes(owner, "app.audit_log")).toMatchObject({
      actor_user_id: "text",
    });
  });
});

// A course description of 20 KB: letters from a fixed pseudo-random sequence,
// which Postgres cannot compress, as it could a repeated letter.
function description(seed: number) {
  let state = seed;
  return Array.from({ length: 20_480 }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return "abcdefghijklmnopqrstuvwxyz "[(state >>> 0) % 27];
  }).join("");
}

describe("the diff of an audit row (A4.22)", () => {
  test("of an edit of a 20 KB description leaves a row under 1 KB", async () => {
    await record({
      actorUserId: uuidv7(),
      action: "course_updated",
      entity: "course",
      entityId: uuidv7(),
      before: { title: "Curso Fictício", description: description(1) },
      after: { title: "Curso Fictício", description: description(2) },
    });

    const [{ size }] = await owner<{ size: number }[]>`
      select pg_column_size(a.*) as size from app.audit_log a`;
    expect(size).toBeLessThan(1_024);
  });

  test("keeps a field of up to 256 characters whole, and a longer one as its length and SHA-256", async () => {
    await record({
      actorUserId: uuidv7(),
      action: "course_updated",
      entity: "course",
      entityId: uuidv7(),
      // 256 characters in 512 bytes of UTF-8: the limit counts characters.
      before: { title: "a".repeat(256), synopsis: "ç".repeat(256) },
      after: { title: "a".repeat(257), synopsis: null },
    });

    const [entry] = await storedEntries();
    expect(entry.diff).toEqual({
      before: { title: "a".repeat(256), synopsis: "ç".repeat(256) },
      after: {
        // `printf 'a%.0s' $(seq 1 257) | sha256sum`
        title: {
          length: 257,
          sha256:
            "e8d95cc2b4bc198c54b40bd214df958afb65f5e73d2c2eafe0593cf5c635c1f0",
        },
        synopsis: null,
      },
    });
  });
});
