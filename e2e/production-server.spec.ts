import { expect, test } from "@playwright/test";

// Seam 5: the E2E runs against Next's production server, never the dev server.
// Next serves the hashed files of a production build with a year-long immutable
// cache (its guide "CDN caching"), which the dev server never does.
test("the server under test is Next's production server", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const asset = await page
    .locator('script[src^="/_next/static/"]')
    .first()
    .getAttribute("src");

  const response = await request.get(asset!);

  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable",
  );
});
