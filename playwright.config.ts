import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import {
  baseUrl,
  closedSignUpEnvironment,
  closedSignUpPort,
  closedSignUpUrl,
  databaseDownEnvironment,
  databaseDownPort,
  databaseDownUrl,
  e2eEnvironment,
  port,
} from "./e2e/support/environment";

// Better Auth refuses its default secret in production: each run makes its
// own, so no secret is ever written down.
function newSecret() {
  return randomBytes(32).toString("base64");
}

// The first server's secret, which the server with the database out of reach
// shares: a session cookie the first signed is one the other reads.
const secret = newSecret();

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
  // valid configuration. A second server of the same build runs with the
  // public sign-up closed, which proves the sign-up page reads the switch as
  // the running server has it, not as the build had it (A2.20). A third one
  // has its database out of reach, for the private area's error page.
  webServer: [
    productionServer(port, baseUrl, e2eEnvironment, secret),
    productionServer(
      closedSignUpPort,
      closedSignUpUrl,
      closedSignUpEnvironment,
      newSecret(),
    ),
    productionServer(
      databaseDownPort,
      databaseDownUrl,
      databaseDownEnvironment,
      secret,
    ),
  ],
});

function productionServer(
  serverPort: number,
  url: string,
  env: Record<string, string>,
  serverSecret: string,
) {
  return {
    command: `pnpm start --port ${serverPort}`,
    url,
    env: { ...env, BETTER_AUTH_SECRET: serverSecret },
    reuseExistingServer: false,
    timeout: 120_000,
  };
}
