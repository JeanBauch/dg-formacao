import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { connect, testDatabase } from "@/test/db/test-database";

// The migrations in the repository, as drizzle-kit lists them.
const journal = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../drizzle/meta/_journal.json"),
    "utf8",
  ),
) as { entries: unknown[] };

// Seam 2: the database the migrations build from scratch, read from the
// catalog by the administrator, who sees every object.
const admin = connect(testDatabase.adminUrl);

afterAll(async () => {
  await admin.end();
});

describe("migrations on an empty Postgres (A1.1)", () => {
  test("create the app and extensions schemas", async () => {
    const schemas = await admin<{ name: string }[]>`
      select nspname as name from pg_namespace
      where nspname in ('app', 'extensions')
      order by nspname`;

    expect(schemas.map((schema) => schema.name)).toEqual(["app", "extensions"]);
  });

  test("install pg_trgm in the extensions schema", async () => {
    const extensions = await admin<{ schema: string }[]>`
      select n.nspname as schema
      from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'pg_trgm'`;

    expect(extensions).toEqual([{ schema: "extensions" }]);
  });

  test("put every table in the app schema, the log of applied migrations included", async () => {
    const tables = await admin<{ schema: string; name: string }[]>`
      select schemaname as schema, tablename as name from pg_tables
      where schemaname not in ('pg_catalog', 'information_schema')`;

    expect(new Set(tables.map((table) => table.schema))).toEqual(
      new Set(["app"]),
    );
    expect(tables).toContainEqual({
      schema: "app",
      name: "__drizzle_migrations",
    });
  });
});

describe("migrations run by the migrations role (A1.4)", () => {
  test("are all applied", async () => {
    const [{ applied }] = await admin<{ applied: number }[]>`
      select count(*)::int as applied from app.__drizzle_migrations`;

    expect(applied).toBe(journal.entries.length);
  });

  test("leave the migrations role owning the schemas and every table", async () => {
    const owners = await admin<{ object: string; owner: string }[]>`
      select nspname as object, pg_get_userbyid(nspowner) as owner
      from pg_namespace where nspname in ('app', 'extensions')
      union all
      select schemaname || '.' || tablename, tableowner from pg_tables
      where schemaname = 'app'`;

    expect(owners.length).toBeGreaterThan(2);
    for (const { object, owner } of owners) {
      expect(owner, object).toBe("dg_migrations");
    }
  });
});
