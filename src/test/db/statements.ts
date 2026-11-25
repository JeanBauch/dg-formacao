import { db } from "@/data/db/client";

// Every statement the app's database client sends while `run` runs, in order:
// what the database receives from the code under test, and the values it sends
// with them. It reads them through the driver's own `debug` option, which
// postgres-js calls for each statement it sends, those of a transaction
// included. Nothing else changes.
export async function statementsSentDuring<T>(run: () => Promise<T>) {
  const statements: string[] = [];
  const values: unknown[] = [];
  const options = db.$client.options;
  const previous = options.debug;
  options.debug = (_connection, statement, parameters: unknown[]) => {
    statements.push(statement);
    values.push(...parameters);
  };
  try {
    return { result: await run(), statements, values };
  } finally {
    options.debug = previous;
  }
}
