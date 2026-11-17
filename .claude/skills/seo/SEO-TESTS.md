# SEO checks in Playwright

Adapt the routes and seed slugs to the project. Assert on the raw HTML (`request.get`) where a crawler without JavaScript matters, and on `page` for rendered behaviour.

```ts
// e2e/seo.spec.ts
import { test, expect, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";

async function jsonLd(page: Page) {
  const raw = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return raw
    .map((t) => JSON.parse(t))
    .flatMap((b) => (Array.isArray(b) ? b : [b])); // throws on invalid JSON
}

test("course page: metadata and JSON-LD", async ({ page }) => {
  const res = await page.goto("/courses/<seed-slug>");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/.+ \| .+/);
  await expect(page.locator("meta[name=description]")).toHaveAttribute(
    "content",
    /.{50,}/,
  );
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
    "href",
    `${base}/courses/<seed-slug>`,
  );
  const blocks = await jsonLd(page);
  const course = blocks.find((b) => b["@type"] === "Course");
  expect(
    course?.name && course?.description && course?.provider?.name,
  ).toBeTruthy();
  expect(
    blocks.find((b) => b["@type"] === "BreadcrumbList")?.itemListElement.length,
  ).toBeGreaterThanOrEqual(2);
  await expect(page.locator("h1")).toContainText(course.name);
});

test("unknown course returns a real 404 with noindex", async ({ page }) => {
  const res = await page.goto("/courses/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator("meta[name=robots]")).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("private area is noindex or redirects to login", async ({ page }) => {
  await page.goto("/learn");
  const robots = await page
    .locator("meta[name=robots]")
    .getAttribute("content");
  expect(page.url().includes("/login") || /noindex/.test(robots ?? "")).toBe(
    true,
  );
});

test("sorted catalog is noindex", async ({ page }) => {
  await page.goto("/courses?sort=newest");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("sitemap and robots", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/courses/<seed-slug>");
  expect(xml).not.toContain("/learn");
  expect(await (await request.get("/robots.txt")).text()).toMatch(
    /Sitemap:\s*https?:\/\//,
  );
});

test('JSON-LD has no raw "<"', async ({ request }) => {
  const html = await (await request.get("/courses/<seed-slug>")).text();
  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    expect(m[1]).not.toMatch(/</);
  }
});
```

Notes:

- If the 404 test sees 200, `notFound()` runs after streaming started: move it above the Suspense boundary or remove the segment's `loading.tsx`.
- To check what HTML-limited bots get, use `request.get` with `headers: { 'user-agent': 'Twitterbot/1.0' }` and assert `<title>` and `og:` tags sit in `<head>`.
- Unit-test the JSON-LD builders and the canonical-from-`searchParams` function separately.
