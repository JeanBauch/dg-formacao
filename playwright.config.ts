import { defineConfig, devices } from "@playwright/test";

// Its own port, so a dev server already running is never hit.
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI runs `pnpm build` first, so it serves the production build; locally it starts a dev server.
    command: `${process.env.CI ? "pnpm start" : "pnpm dev"} --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
