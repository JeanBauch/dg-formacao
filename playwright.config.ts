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
    // The server refuses to start without a valid configuration; these are the fictitious
    // local values of .env.example.
    env: {
      APP_ENV: process.env.CI ? "ci" : "local",
      SIGNUP_ENABLED: "true",
      DATABASE_URL: "postgresql://app:app@localhost:5432/dg_formacao",
      MAILER_ADAPTER: "file",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
