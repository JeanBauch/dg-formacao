import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { setUpTestDatabase } from "./setup";
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
  try {
    await development`create table public.test_setup_marker (note text)`;
    await development`insert into public.test_setup_marker (note) values ('kept')`;

    await setUpTestDatabase();

    expect(
      await development`select note from public.test_setup_marker`,
    ).toEqual([{ note: "kept" }]);
  } finally {
    await development`drop table if exists public.test_setup_marker`;
    await development.end();
  }
}, 60_000);
