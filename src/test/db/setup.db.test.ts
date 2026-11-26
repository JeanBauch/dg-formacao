import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { assertPostgresReachable, setUpTestDatabase } from "./setup";
import { connect, testDatabase } from "./test-database";

// The development database is the one the inventory (.env.example) names, in
// the same container as the test database.
function developmentDatabaseUrl() {
  const inventory = readFileSync(
    resolve(import.meta.dirname, "../../../.env.example"),
    "utf8",
  );
  const line = /^DATABASE_URL=(.+)$/m.exec(inventory);
  if (!line) throw new Error("The inventory has no DATABASE_URL.");
  const url = new URL(testDatabase.serverUrl);
  url.pathname = new URL(line[1]).pathname;
  return url.toString();
}

// A1.14: the database tests use their own database in the same container.
test("the test setup leaves the development database and its data intact", async () => {
  const development = connect(developmentDatabaseUrl());
  // A name of this run alone: a table a developer or an interrupted run left
  // behind is never reused, nor dropped.
  const marker = development(
    `test_setup_marker_${randomBytes(6).toString("hex")}`,
  );
  let created = false;
  try {
    await development`create table public.${marker} (note text)`;
    created = true;
    await development`insert into public.${marker} (note) values ('kept')`;

    await setUpTestDatabase();

    expect(await development`select note from public.${marker}`).toEqual([
      { note: "kept" },
    ]);
  } finally {
    if (created) await development`drop table public.${marker}`;
    await development.end();
  }
}, 60_000);

// The container's server, reached with something it refuses.
function refusedUrl(change: (url: URL) => void) {
  const url = new URL(testDatabase.serverUrl);
  change(url);
  return url.toString();
}

// A1.10: a Postgres that answers and refuses, such as another one already on
// the port, is not reported as down: the check shows its code and message.
test.each([
  [
    "a password it refuses",
    refusedUrl((url) => {
      url.password = "not-the-password";
    }),
    "28P01",
    "password authentication failed",
  ],
  [
    "a database it does not have",
    refusedUrl((url) => {
      url.pathname = "/dg_formacao_missing";
    }),
    "3D000",
    'database "dg_formacao_missing" does not exist',
  ],
])(
  "with %s, the check says Postgres answered and refused, and names the script",
  async (_, url, code, message) => {
    const failure = assertPostgresReachable(url);

    await expect(failure).rejects.toThrow(
      "Postgres at localhost:5432 answered but refused",
    );
    await expect(failure).rejects.toThrow(code);
    await expect(failure).rejects.toThrow(message);
    await expect(failure).rejects.toThrow(/`pnpm db:up`/);
    await expect(failure).rejects.not.toThrow(/not answering/);
    // The E2E's setup runs the same check before its first test.
    await expect(failure).rejects.toThrow(
      /^These tests need the local Postgres/,
    );
    await expect(failure).rejects.not.toThrow(/database tests/);
  },
);
