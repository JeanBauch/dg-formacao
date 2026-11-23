import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { applyRolesAndMigrations } from "@/test/db/setup";
import { connect, testDatabase } from "@/test/db/test-database";

// Running the scripts again spawns them, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000 });

// Seam 2: the three database roles, as the roles script and the migrations
// leave them, observed by connecting as each role.
const admin = connect(testDatabase.adminUrl);
const app = connect(testDatabase.appUrl);
const migrations = connect(testDatabase.migrationsUrl);

afterAll(async () => {
  await Promise.all([admin.end(), app.end(), migrations.end()]);
});

const refused = { code: "42501" }; // insufficient_privilege

describe("the application role (A1.2)", () => {
  // A table the migrations role creates, as a later migration would.
  beforeAll(async () => {
    await migrations`create table app.roles_probe (id int primary key, note text)`;
  });

  afterAll(async () => {
    await migrations`drop table if exists app.roles_probe`;
  });

  test("reads, writes and deletes the rows of an app table", async () => {
    await app`insert into app.roles_probe (id, note) values (1, 'created')`;
    await app`update app.roles_probe set note = 'changed' where id = 1`;
    const rows = await app`select id, note from app.roles_probe`;
    await app`delete from app.roles_probe where id = 1`;

    expect(rows).toEqual([{ id: 1, note: "changed" }]);
    expect(await app`select id from app.roles_probe`).toEqual([]);
  });

  test("cannot create a table, in app or in public", async () => {
    await expect(app`create table app.by_app (id int)`).rejects.toMatchObject(
      refused,
    );
    await expect(
      app`create table public.by_app (id int)`,
    ).rejects.toMatchObject(refused);
  });

  test("cannot alter a table", async () => {
    await expect(
      app`alter table app.roles_probe add column extra text`,
    ).rejects.toMatchObject(refused);
  });

  test("cannot drop a table", async () => {
    await expect(app`drop table app.roles_probe`).rejects.toMatchObject(
      refused,
    );
  });

  test("cannot read or change the log of applied migrations", async () => {
    await expect(
      app`select hash from app.__drizzle_migrations`,
    ).rejects.toMatchObject(refused);
    await expect(
      app`delete from app.__drizzle_migrations`,
    ).rejects.toMatchObject(refused);
  });
});

// Everything the roles script and the migrations decide: the roles and their
// attributes, who owns what, every grant and default privilege, and the
// migrations applied.
async function databaseState() {
  return {
    roles: await admin`
      select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
        rolcanlogin, rolreplication, rolbypassrls
      from pg_roles where rolname like 'dg\_%' order by rolname`,
    database: await admin`
      select datacl::text from pg_database where datname = current_database()`,
    schemas: await admin`
      select nspname, pg_get_userbyid(nspowner) as owner, nspacl::text
      from pg_namespace where nspname in ('app', 'extensions', 'public')
      order by nspname`,
    relations: await admin`
      select relname, pg_get_userbyid(relowner) as owner, relacl::text
      from pg_class where relnamespace = 'app'::regnamespace order by relname`,
    defaultPrivileges: await admin`
      select pg_get_userbyid(defaclrole) as role,
        defaclnamespace::regnamespace::text as schema, defaclobjtype,
        defaclacl::text
      from pg_default_acl order by 1, 2, 3`,
    migrations: await admin`
      select hash, created_at from app.__drizzle_migrations order by id`,
  };
}

describe("the roles script (A1.11)", () => {
  afterAll(async () => {
    await migrations`drop table if exists app.existing_probe`;
  });

  test.each([
    ["dg_app", testDatabase.appUrl],
    ["dg_migrations", testDatabase.migrationsUrl],
    ["dg_readonly", testDatabase.readonlyUrl],
  ])(
    "part 1 creates %s, which logs in with the password it was given",
    async (role, url) => {
      const session = connect(url);
      try {
        expect(await session`select current_user as role`).toEqual([{ role }]);
      } finally {
        await session.end();
      }
    },
  );

  test("part 2 gives the application role the rows of tables that existed before it ran", async () => {
    // A table from a migration that ran before any default privilege existed,
    // as on a fresh database, where the migrations run before part 2.
    await migrations`alter default privileges in schema app
      revoke select, insert, update, delete on tables from dg_app`;
    await migrations`create table app.existing_probe (id int primary key)`;
    await expect(
      app`insert into app.existing_probe (id) values (1)`,
    ).rejects.toMatchObject(refused);

    await applyRolesAndMigrations();

    await app`insert into app.existing_probe (id) values (1)`;
    expect(await app`select id from app.existing_probe`).toEqual([{ id: 1 }]);
  });

  test("part 2 lets the application role use the extensions schema", async () => {
    const [{ similarity }] = await app<{ similarity: number }[]>`
      select extensions.similarity('curso', 'curso') as similarity`;

    expect(similarity).toBe(1);
  });

  test("run again with the migrations, in the same order, changes nothing", async () => {
    const before = await databaseState();

    await applyRolesAndMigrations();

    expect(await databaseState()).toEqual(before);
  });
});
