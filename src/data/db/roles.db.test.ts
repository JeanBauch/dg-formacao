import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { applyRolesAndMigrations } from "@/test/db/setup";
import { connect, testDatabase } from "@/test/db/test-database";

const rolesScript = resolve(
  import.meta.dirname,
  "../../../scripts/db-roles.mts",
);

// Running the scripts again spawns them, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000 });

// Seam 2: the three database roles, as the roles script and the migrations
// leave them, observed by connecting as each role.
const admin = connect(testDatabase.adminUrl);
const app = connect(testDatabase.appUrl);
const migrations = connect(testDatabase.migrationsUrl);
const readonly = connect(testDatabase.readonlyUrl);

afterAll(async () => {
  try {
    // The audit rows the application role wrote, which only the migrations
    // role can delete (A1.12).
    await migrations`truncate app.audit_log`;
  } finally {
    await Promise.all([
      admin.end(),
      app.end(),
      migrations.end(),
      readonly.end(),
    ]);
  }
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

describe("the application role and the audit log (A1.12)", () => {
  async function insertAuditRow() {
    const id = uuidv7();
    await app`
      insert into app.audit_log
        (id, actor_user_id, action, entity, entity_id, diff)
      values (${id}, ${uuidv7()}, 'staff_invited', 'user', ${uuidv7()},
        ${app.json({ before: null, after: { role: "instructor" } })})`;
    return id;
  }

  test("inserts and reads an audit row", async () => {
    const id = await insertAuditRow();

    expect(
      await app`select action from app.audit_log where id = ${id}`,
    ).toEqual([{ action: "staff_invited" }]);
  });

  test("cannot change, delete or truncate an audit row", async () => {
    const id = await insertAuditRow();

    await expect(
      app`update app.audit_log set action = 'changed' where id = ${id}`,
    ).rejects.toMatchObject(refused);
    await expect(
      app`delete from app.audit_log where id = ${id}`,
    ).rejects.toMatchObject(refused);
    await expect(app`truncate app.audit_log`).rejects.toMatchObject(refused);
    expect(
      await migrations`select action from app.audit_log where id = ${id}`,
    ).toEqual([{ action: "staff_invited" }]);
  });
});

describe("the read-only role (A1.3, A5.8)", () => {
  const logs = ["audit_log", "security_events"];

  // Every table of app, as the administrator sees them: the ones that exist
  // now and any a later migration adds.
  async function appTables() {
    const tables = await admin<{ name: string }[]>`
      select tablename as name from pg_tables where schemaname = 'app'
      order by tablename`;
    return tables.map(({ name }) => name);
  }

  test.each(logs)("reads the %s table", async (table) => {
    await readonly`select * from app.${readonly(table)}`;
  });

  test("cannot read any other table of app, Better Auth's tables with secrets included", async () => {
    const others = (await appTables()).filter((name) => !logs.includes(name));

    expect(others).toEqual(
      expect.arrayContaining([
        "user",
        "account",
        "session",
        "verification",
        "rate_limit",
      ]),
    );
    for (const table of others) {
      await expect(
        readonly`select * from app.${readonly(table)}`,
        table,
      ).rejects.toMatchObject(refused);
    }
  });

  test("cannot insert, change or delete a row of any table of app, the two logs included", async () => {
    for (const table of await appTables()) {
      const [{ column }] = await admin<{ column: string }[]>`
        select attname as column from pg_attribute
        where attrelid = ${`app."${table}"`}::regclass and attnum = 1`;
      const name = readonly(table);
      await expect(
        readonly`insert into app.${name} default values`,
        `insert into ${table}`,
      ).rejects.toMatchObject(refused);
      await expect(
        readonly`update app.${name} set ${readonly(column)} = ${readonly(column)}`,
        `update ${table}`,
      ).rejects.toMatchObject(refused);
      await expect(
        readonly`delete from app.${name}`,
        `delete from ${table}`,
      ).rejects.toMatchObject(refused);
    }
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
      from pg_roles
      where rolname in ('dg_app', 'dg_migrations', 'dg_readonly')
      order by rolname`,
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

  // A role that already exists with more than its login, granted by hand or
  // restored from a dump of the roles. Roles belong to the whole server, so
  // each case puts the role back as it was.
  test.each([
    ["dg_app", "SUPERUSER", "alter role dg_app nosuperuser"],
    ["dg_app", "CREATEDB", "alter role dg_app nocreatedb"],
    ["dg_migrations", "CREATEROLE", "alter role dg_migrations nocreaterole"],
    ["dg_readonly", "REPLICATION", "alter role dg_readonly noreplication"],
    ["dg_readonly", "BYPASSRLS", "alter role dg_readonly nobypassrls"],
  ])(
    "part 1 stops when %s already exists with %s",
    async (role, attribute, restore) => {
      await admin.unsafe(`alter role ${role} ${attribute}`);
      try {
        await expect(applyRolesAndMigrations()).rejects.toThrow(
          new RegExp(`role ${role} already exists with .*${attribute}`),
        );
      } finally {
        await admin.unsafe(restore);
      }
    },
  );

  test("part 1 stops when dg_app already exists as a member of dg_migrations", async () => {
    await admin`grant dg_migrations to dg_app`;
    try {
      await expect(applyRolesAndMigrations()).rejects.toThrow(
        /role dg_app already exists with .*membership in dg_migrations/,
      );
    } finally {
      await admin`revoke dg_migrations from dg_app`;
    }
  });

  test("part 2 gives the application role the rows of tables that existed before it ran", async () => {
    // A table from a migration that ran before any default privilege existed,
    // as on a fresh database, where the migrations run before part 2.
    await migrations`alter default privileges in schema app
      revoke select, insert, update, delete on tables from dg_app`;
    try {
      await migrations`create table app.existing_probe (id int primary key)`;
      await expect(
        app`insert into app.existing_probe (id) values (1)`,
      ).rejects.toMatchObject(refused);

      await applyRolesAndMigrations();

      await app`insert into app.existing_probe (id) values (1)`;
      expect(await app`select id from app.existing_probe`).toEqual([{ id: 1 }]);
    } finally {
      // Whatever happened above, the tables created later, in this file or the
      // next ones, still give the application role their rows, and the probe
      // is gone.
      await migrations`alter default privileges in schema app
        grant select, insert, update, delete on tables to dg_app`;
      await migrations`drop table if exists app.existing_probe`;
    }
  });

  test("part 2 lets the application role use the extensions schema", async () => {
    const [{ similarity }] = await app<{ similarity: number }[]>`
      select extensions.similarity('curso', 'curso') as similarity`;

    expect(similarity).toBe(1);
  });

  // Names an object inherits, besides a part that does not exist: a pipeline
  // step with a wrong argument must fail, never succeed having done nothing.
  test.each(["constructor", "toString", "__proto__", "part-3"])(
    "refuses the argument %s with the usage",
    async (argument) => {
      const stderr = await promisify(execFile)(process.execPath, [
        rolesScript,
        argument,
      ]).then(
        () => "the script exited 0",
        (failure: { stderr: string }) => failure.stderr,
      );

      expect(stderr).toContain(
        "Usage: node scripts/db-roles.mts part-1|part-2",
      );
    },
  );

  test("run again with the migrations, in the same order, changes nothing", async () => {
    const before = await databaseState();

    await applyRolesAndMigrations();

    expect(await databaseState()).toEqual(before);
  });
});
