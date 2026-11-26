import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import {
  baseUrl,
  closedSignUpEnvironment,
  closedSignUpPort,
  closedSignUpUrl,
  e2eEnvironment,
  port,
} from "./e2e/support/environment";

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
    // The suite signs in once per role and reuses the state (seam 5).
    {
      name: "holder",
      testMatch: "holder.setup.ts",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["database"],
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["holder"],
    },
  ],
  // Next's production server, locally and in CI, never the dev server: it
  // serves the build `pnpm build` made. The server refuses to start without a
  // valid configuration, and Better Auth refuses its default secret in
  // production: each server's is made anew on each run, so no secret is ever
  // written down. A second server of the same build runs with the public
  // sign-up closed, which proves the sign-up page reads the switch as the
  // running server has it, not as the build had it (A2.20).
  webServer: [
    productionServer(port, baseUrl, e2eEnvironment),
    productionServer(
      closedSignUpPort,
      closedSignUpUrl,
      closedSignUpEnvironment,
    ),
  ],
});

function productionServer(
  serverPort: number,
  url: string,
  env: Record<string, string>,
) {
  return {
    command: `pnpm start --port ${serverPort}`,
    url,
    env: { ...env, BETTER_AUTH_SECRET: randomBytes(32).toString("base64") },
    reuseExistingServer: false,
    timeout: 120_000,
  };
}
