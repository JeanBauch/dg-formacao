// @vitest-environment node
import { createServer, type AddressInfo } from "node:net";
import { expect, test } from "vitest";
import { assertPostgresReachable } from "./setup";

// A port nothing listens on: taken from the system, then released.
async function closedPort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// A1.10: the database tests check the database before their first test.
test("with the database down, the check says to start it and names the script", async () => {
  const url = `postgresql://postgres:postgres@127.0.0.1:${await closedPort()}/postgres`;

  const failure = assertPostgresReachable(url);

  await expect(failure).rejects.toThrow(/start it with `pnpm db:up`/i);
  await expect(failure).rejects.toThrow(/not answering/);
}, 15_000);

// The E2E's setup runs the same check before its first test.
test("with the database down, the check speaks of the tests it stops, whichever suite they are", async () => {
  const url = `postgresql://postgres:postgres@127.0.0.1:${await closedPort()}/postgres`;

  const failure = assertPostgresReachable(url);

  await expect(failure).rejects.toThrow(/^These tests need the local Postgres/);
  await expect(failure).rejects.not.toThrow(/database tests/);
}, 15_000);
