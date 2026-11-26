import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";
import {
  connect,
  type LocalDatabase,
  rolePasswords,
  testDatabase,
} from "./test-database";

// Paths from the repository's root, where every runner of these helpers starts:
// Vitest, Playwright and the hooks. Playwright loads this file as CommonJS,
// which has no `import.meta` to find the root from.
const drizzleKit = "node_modules/drizzle-kit/bin.cjs";
const rolesScript = "scripts/db-roles.mts";

// Runs a Node script of the repository with these variables on top of the
// current environment, and reports its output when it fails.
export async function runScript(args: string[], env: Record<string, string>) {
  try {
    await promisify(execFile)(process.execPath, args, {
      env: { ...process.env, ...env },
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    throw new Error(
      `${args.join(" ")} failed:\n${stdout ?? ""}${stderr ?? ""}`.trimEnd(),
      { cause: error },
    );
  }
}

// A1.10: with the database down, the database tests stop before their first
// test with what to do, never with a bare connection error. A server that
// answers and refuses (a wrong password, a missing database, another Postgres
// already on the port) is not down, so its own code and message are shown. The
// error code is kept; the connection error itself is not attached, because
// Vitest would print it in full after the message.
export async function assertPostgresReachable(url: string) {
  const server = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    await server`select 1`;
  } catch (error) {
    const { hostname, port } = new URL(url);
    if (error instanceof postgres.PostgresError) {
      throw new Error(
        `The database tests need the local Postgres. Postgres at ${hostname}:${port} answered but refused (${error.code}: ${error.message}). ` +
          "They expect the container from `pnpm db:up`: if another Postgres holds that port, stop it, then run `pnpm db:up` and the tests again.",
      );
    }
    const reason = (error as { code?: string }).code ?? String(error);
    throw new Error(
      `The database tests need the local Postgres, which is not answering at ${hostname}:${port} (${reason}). ` +
        "Start it with `pnpm db:up`, then run the tests again.",
    );
  } finally {
    await server.end();
  }
}

async function recreateDatabase({ name, serverUrl }: LocalDatabase) {
  const server = connect(serverUrl);
  try {
    await server`drop database if exists ${server(name)} with (force)`;
    await server`create database ${server(name)}`;
    // The database is recreated on every run, so a commit need not wait for
    // the disk, which takes about 80 ms on Docker Desktop: the attack of NF-5
    // alone commits 5,000 times. Locks and visibility stay the same.
    await server`alter database ${server(name)} set synchronous_commit = off`;
  } finally {
    await server.end();
  }
}

// The order of A1.11: part 1 of the roles script with the administrator
// credential, the migrations, then part 2, both as the migrations role. These
// are the same scripts that set up every other database.
export async function applyRolesAndMigrations(database = testDatabase) {
  await runScript([rolesScript, "part-1"], {
    DATABASE_ADMIN_URL: database.adminUrl,
    DATABASE_APP_PASSWORD: rolePasswords.app,
    DATABASE_MIGRATIONS_PASSWORD: rolePasswords.migrations,
    DATABASE_READONLY_PASSWORD: rolePasswords.readonly,
  });
  await runScript([drizzleKit, "migrate"], {
    DATABASE_URL_DIRECT: database.migrationsUrl,
  });
  await runScript([rolesScript, "part-2"], {
    DATABASE_URL_DIRECT: database.migrationsUrl,
  });
}

// An empty database of the local container, migrated from scratch.
export async function setUpDatabase(database: LocalDatabase) {
  await assertPostgresReachable(database.serverUrl);
  await recreateDatabase(database);
  await applyRolesAndMigrations(database);
}

// Prepares the database of the database tests, once per test run.
export async function setUpTestDatabase() {
  await setUpDatabase(testDatabase);
}
