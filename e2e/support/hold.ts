import type { Page } from "@playwright/test";

// Holds the page's requests to this address until the test releases them, so
// the test can see the page while a request is pending.
export async function holdRequests(page: Page, url: string) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}
