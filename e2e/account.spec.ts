import { seedHolder } from "../src/test/seed-accounts";
import { baseUrl } from "./support/environment";
import { holderState } from "./support/holder-state";
import { expect, test } from "./support/test";

// Seam 5, against the production server: the account's page, as the seed's
// holder signed in once by the setup sees it.
test.use({ storageState: holderState });

test("the account's page shows the holder's name, e-mail and confirmed e-mail", async ({
  page,
}) => {
  await page.goto("/conta");

  await expect(page.getByText(seedHolder.name)).toBeVisible();
  await expect(page.getByText(seedHolder.email)).toBeVisible();
  await expect(page.getByText("Confirmado")).toBeVisible();
});

// A page rendered on the server sets no cookie, so the daily renewal of a
// remembered session (A2.7) happens on the client's read over Better Auth's
// HTTP, which renews the session and its cookie when they are due (seam 1).
test("opening the account's page has the client read the session over Better Auth's HTTP", async ({
  page,
}) => {
  const sessionRead = page.waitForResponse(`${baseUrl}/api/auth/get-session`);

  await page.goto("/conta");

  const response = await sessionRead;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    user: { email: seedHolder.email },
  });
});

// NF-1's absolute bound, loose on purpose: a private page answers in under 1 s
// in CI (RNF-PER-01's p99). The first request after the server starts loads
// the route and opens the database's connections, so it warms up first, and
// each of the next ten must answer in time, the whole page received.
test("the account's page answers in under 1 s (NF-1)", async ({ page }) => {
  const load = async () => {
    const started = performance.now();
    const response = await page.request.get("/conta");
    const html = await response.text();
    return { response, html, elapsed: performance.now() - started };
  };
  await load();

  for (let request = 0; request < 10; request += 1) {
    const { response, html, elapsed } = await load();

    expect(response.status()).toBe(200);
    // The private page itself, not the sign-in a missing session leads to.
    expect(html).toContain(seedHolder.email);
    expect(elapsed).toBeLessThan(1000);
  }
});
