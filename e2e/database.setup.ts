import { test as setup } from "@playwright/test";
import { runScript, setUpDatabase } from "../src/test/db/setup";
import { e2eDatabase } from "../src/test/db/test-database";
import { e2eEnvironment } from "./support/environment";

// Runs before every E2E, locally and in CI: the E2E's database, dropped and
// created again, gets part 1 of the roles script, the migrations from scratch,
// part 2 (A1.11) and the seed's holder (A1.8). The server is already up by then,
// and connects to the database only when a test sends it a request.
setup("the E2E database is migrated from scratch and seeded", async () => {
  setup.setTimeout(120_000);

  await setUpDatabase(e2eDatabase);
  await runScript(["scripts/db-seed.mts"], e2eEnvironment);
});
