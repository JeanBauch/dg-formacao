import type { Sql } from "postgres";
import { connect, testDatabase } from "./test-database";

// The key of the advisory lock a gate's own connection holds while it is closed.
const gateLock = 1717;

// The tables a gate can hold a write to: each has a user_id column.
const gatedTables = ["session", "account", "sign_in_failures"] as const;

// A gate on one kind of write to one user's rows of a table, for a test that
// makes requests cross in a chosen order, or meet at the same time: while the
// gate is closed, each such write waits at it, inside its own statement and
// transaction, before it changes the row. An insert that meets a conflict
// waits there too, before Postgres looks for the conflict. A trigger made for
// the test waits on an advisory lock the gate's own connection holds; `owner`
// is a connection of the migrations role, which owns the tables. One gate at a
// time; `removeGate` drops it.
export async function closedGate(
  owner: Sql,
  write: "insert" | "update",
  table: (typeof gatedTables)[number],
  userId: string,
) {
  const holder = connect(testDatabase.migrationsUrl);
  await holder`select pg_advisory_lock(${gateLock})`;
  const row = write === "insert" ? "new" : "old";
  await owner.unsafe(`
    create function app.test_gate() returns trigger language plpgsql as $$
    begin
      perform pg_advisory_xact_lock_shared(${gateLock});
      return new;
    end $$;
    create trigger test_gate before ${write} on app.${table} for each row
      when (${row}.user_id = '${userId}') execute function app.test_gate();
  `);
  return {
    // Resolves once this many writes wait at the gate, one by default.
    async reached(writes = 1) {
      for (let check = 0; check < 300; check += 1) {
        const [{ waiting }] = await owner<{ waiting: number }[]>`
          select count(*)::int as waiting from pg_locks
          where locktype = 'advisory' and objid = ${gateLock} and not granted`;
        if (waiting >= writes) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Fewer than ${writes} writes reached the gate`);
    },
    // Ending the connection releases its lock, and the writes go on.
    async open() {
      await holder.end();
    },
  };
}

export type Gate = Awaited<ReturnType<typeof closedGate>>;

// Opens the gate, if one is still closed, then drops its trigger: the drop
// would wait for a write still held at the gate.
export async function removeGate(owner: Sql, gate: Gate | undefined) {
  await gate?.open();
  await owner.unsafe(`
    ${gatedTables.map((table) => `drop trigger if exists test_gate on app.${table};`).join("\n")}
    drop function if exists app.test_gate();
  `);
}
