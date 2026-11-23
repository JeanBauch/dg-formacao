// The roles script (RNF-SEG-05): the database has three roles, the application
// role without DDL, the migrations role and a read-only role, and they are set
// up here, outside the migrations. The order is always part 1, the migrations,
// then part 2:
//
//   node scripts/db-roles.mts part-1   with the administrator credential
//   node scripts/db-roles.mts part-2   with the migrations role
//
// Passwords come from the environment, never from the repository.
import postgres from "postgres";

const roles = {
  app: "dg_app",
  migrations: "dg_migrations",
  readonly: "dg_readonly",
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`The roles script needs ${name}.`);
  return value;
}

function connect(url: string) {
  return postgres(url, { max: 1, onnotice: () => {} });
}

// Part 1, as the administrator (DATABASE_ADMIN_URL), on the database that URL
// names: creates the three roles with their passwords and lets the migrations
// role create the schemas. A role that already exists keeps its name and gets
// the password from the environment again, so a second run changes nothing.
async function part1() {
  const passwords = {
    [roles.app]: required("DATABASE_APP_PASSWORD"),
    [roles.migrations]: required("DATABASE_MIGRATIONS_PASSWORD"),
    [roles.readonly]: required("DATABASE_READONLY_PASSWORD"),
  };
  const sql = connect(required("DATABASE_ADMIN_URL"));
  try {
    await sql.begin(async (tx) => {
      for (const [role, password] of Object.entries(passwords)) {
        // A role statement takes no bind parameters, so Postgres quotes the
        // password itself.
        const [{ exists, literal }] = await tx<
          { exists: boolean; literal: string }[]
        >`
          select exists (select from pg_roles where rolname = ${role}) as exists,
            quote_literal(${password}::text) as literal`;
        const command = exists ? "alter" : "create";
        await tx.unsafe(
          `${command} role ${role} with login password ${literal}`,
        );
      }
      const [{ database }] = await tx<{ database: string }[]>`
        select quote_ident(current_database()) as database`;
      await tx.unsafe(
        `grant create on database ${database} to ${roles.migrations}`,
      );
    });
  } finally {
    await sql.end();
  }
}

// Part 2, as the migrations role (DATABASE_URL_DIRECT), after every migration.
// Default privileges apply only to tables created later, and they give the
// application role every row of each new table.
const part2Statements = [
  `grant usage on schema app to ${roles.app}, ${roles.readonly}`,
  `grant usage on schema extensions to ${roles.app}`,
  `grant select, insert, update, delete on all tables in schema app
    to ${roles.app}`,
  `alter default privileges in schema app
    grant select, insert, update, delete on tables to ${roles.app}`,
  // Per-table exceptions, which run after the grants above. The log of applied
  // migrations belongs to the migrations role alone.
  `revoke all on table app.__drizzle_migrations from ${roles.app}`,
];

async function part2() {
  const sql = connect(required("DATABASE_URL_DIRECT"));
  try {
    await sql.begin(async (tx) => {
      for (const statement of part2Statements) await tx.unsafe(statement);
    });
  } finally {
    await sql.end();
  }
}

const parts: Record<string, () => Promise<void>> = {
  "part-1": part1,
  "part-2": part2,
};
const part = parts[process.argv[2] ?? ""];
if (!part) throw new Error("Usage: node scripts/db-roles.mts part-1|part-2");
await part();
