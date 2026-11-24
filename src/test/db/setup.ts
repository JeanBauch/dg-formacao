import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";
import {
  connect,
  rolePasswords,
  testDatabase,
  testDatabaseName,
} from "./test-database";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const drizzleKit = resolve(repositoryRoot, "node_modules/drizzle-kit/bin.cjs");
const rolesScript = resolve(repositoryRoot, "scripts/db-roles.mts");

// Runs a Node script of the repository with these variables on top of the
// current environment, and reports its output when it fails.
async function runScript(args: string[], env: Record<string, string>) {
  try {
    await promisify(execFile)(process.execPath, args, {
      cwd: repositoryRoot,
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

async function recreateTestDatabase() {
  const server = connect(testDatabase.serverUrl);
  try {
    await server`drop database if exists ${server(testDatabaseName)} with (force)`;
    await server`create database ${server(testDatabaseName)}`;
  } finally {
    await server.end();
  }
}

// The order of A1.11: part 1 of the roles script with the administrator
// credential, the migrations, then part 2, both as the migrations role. These
// are the same scripts that set up every other database.
export async function applyRolesAndMigrations() {
  await runScript([rolesScript, "part-1"], {
    DATABASE_ADMIN_URL: testDatabase.adminUrl,
    DATABASE_APP_PASSWORD: rolePasswords.app,
    DATABASE_MIGRATIONS_PASSWORD: rolePasswords.migrations,
    DATABASE_READONLY_PASSWORD: rolePasswords.readonly,
  });
  await runScript([drizzleKit, "migrate"], {
    DATABASE_URL_DIRECT: testDatabase.migrationsUrl,
  });
  await runScript([rolesScript, "part-2"], {
    DATABASE_URL_DIRECT: testDatabase.migrationsUrl,
  });
}

// Prepares an empty test database, migrated from scratch, once per test run.
export async function setUpTestDatabase() {
  await assertPostgresReachable(testDatabase.serverUrl);
  await recreateTestDatabase();
  await applyRolesAndMigrations();
}
