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

export const rolePasswords = {
  app: "dg_app",
  migrations: "dg_migrations",
  readonly: "dg_readonly",
};

function databaseUrl(user: string, password: string, database: string) {
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// One database of the container, with the URL each of its users connects by.
function localDatabase(name: string) {
  return {
    name,
    // The container's superuser on its maintenance database, which can drop and
    // create the database.
    serverUrl: databaseUrl("postgres", "postgres", "postgres"),
    // The administrator credential, which part 1 of the roles script uses.
    adminUrl: databaseUrl("postgres", "postgres", name),
    appUrl: databaseUrl("dg_app", rolePasswords.app, name),
    migrationsUrl: databaseUrl("dg_migrations", rolePasswords.migrations, name),
    readonlyUrl: databaseUrl("dg_readonly", rolePasswords.readonly, name),
  };
}

export type LocalDatabase = ReturnType<typeof localDatabase>;

export const testDatabase = localDatabase("dg_formacao_test");

// The database of the E2E's server, apart from the development one and from the
// one above, which every run of the database tests drops and creates again.
export const e2eDatabase = localDatabase("dg_formacao_e2e");

// One connection, quiet about notices. The caller ends it.
export function connect(url: string) {
  return postgres(url, { max: 1, onnotice: () => {} });
}
