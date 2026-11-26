import { expect, test } from "@playwright/test";
import { connect, e2eDatabase } from "../src/test/db/test-database";
import { seedHolder } from "../src/test/seed-accounts";
import { baseUrl } from "./support/environment";

// Seam 5: before the E2E, its database gets part 1 of the roles script, the
// migrations from scratch, part 2 and the seed's holder, and the server connects
// to it as the application role, as the database tests do.
test("the seed's holder signs in on the server, which connects to its database as the application role", async ({
  request,
}) => {
  const response = await request.post("/api/auth/sign-in/email", {
    headers: { origin: baseUrl, "x-forwarded-for": "192.0.2.10" },
    data: { email: seedHolder.email, password: seedHolder.password },
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    user: { email: seedHolder.email, emailVerified: true },
  });
  // The server's connections, as the database itself lists them.
  const admin = connect(e2eDatabase.adminUrl);
  try {
    expect(
      await admin`
        select distinct usename from pg_stat_activity
        where datname = ${e2eDatabase.name} and pid <> pg_backend_pid()
          and backend_type = 'client backend'`,
    ).toEqual([{ usename: "dg_app" }]);
  } finally {
    await admin.end();
  }
});
