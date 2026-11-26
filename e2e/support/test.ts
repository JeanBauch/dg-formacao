import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

let issued = 0;

// A simulated client IP for each test, sent in `x-forwarded-for` by its browser
// and its request context, so the rate limit, which counts per IP, never
// carries over from one test to another. The tests' own helper counts in its
// process, and Playwright runs several processes, its workers, at once: here
// each test takes a /64 network of its own, of the range RFC 3849 reserves for
// documentation, named by its worker's index, which no other worker of the run
// has, and by its number in that worker. Better Auth's rate limit counts an
// IPv6 client by its /64, so no two tests share a counter.
// The fixture's callback is named `provide`, not Playwright's usual `use`,
// which the React hooks rule would take for React's.
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, testInfo) => {
    issued += 1;
    const network = `2001:db8:${(testInfo.workerIndex + 1).toString(16)}:${issued.toString(16)}`;
    await provide({ "x-forwarded-for": `${network}::1` });
  },
});
