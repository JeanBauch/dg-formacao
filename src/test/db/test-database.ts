import postgres from "postgres";

// The database tests run against their own database in the local container
// (`pnpm db:up`) or in the CI service container, apart from the development
// database (A1.14). Every credential here is fictitious and the same in CI, so
// there is no test environment file.
//
// Roles belong to the whole Postgres instance, not to one database, so the role
// passwords are the same fictitious ones the development database uses.
const host = "localhost";
const port = 5432;

export const testDatabaseName = "dg_formacao_test";

export const rolePasswords = {
  app: "dg_app",
  migrations: "dg_migrations",
  readonly: "dg_readonly",
};

function databaseUrl(user: string, password: string, database: string) {
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export const testDatabase = {
  // The container's superuser on its maintenance database, which can drop and
  // create the test database.
  serverUrl: databaseUrl("postgres", "postgres", "postgres"),
  // The administrator credential, which part 1 of the roles script uses.
  adminUrl: databaseUrl("postgres", "postgres", testDatabaseName),
  appUrl: databaseUrl("dg_app", rolePasswords.app, testDatabaseName),
  migrationsUrl: databaseUrl(
    "dg_migrations",
    rolePasswords.migrations,
    testDatabaseName,
  ),
  readonlyUrl: databaseUrl(
    "dg_readonly",
    rolePasswords.readonly,
    testDatabaseName,
  ),
};

// One connection, quiet about notices. The caller ends it.
export function connect(url: string) {
  return postgres(url, { max: 1, onnotice: () => {} });
}
