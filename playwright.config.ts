import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { baseUrl, e2eEnvironment, port } from "./e2e/support/environment";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "database", testMatch: "database.setup.ts" },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["database"],
    },
  ],
  webServer: {
    // Next's production server, locally and in CI, never the dev server: it
    // serves the build `pnpm build` made.
    command: `pnpm start --port ${port}`,
    url: baseUrl,
    // The server refuses to start without a valid configuration. Better Auth
    // refuses its default secret in production: this one is made anew on each
    // run, so no secret is ever written down.
    env: {
      ...e2eEnvironment,
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
