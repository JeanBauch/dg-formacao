import { e2eDatabase } from "../../src/test/db/test-database";

// Its own port, so a server already running is never hit.
export const port = Number(process.env.PORT ?? 3100);

export const baseUrl = `http://localhost:${port}`;

// The configuration of the E2E's server, and of the seed that fills its
// database: the application role on the E2E's own database, and the file
// adapter for the e-mail. Every value is fictitious, and the same locally and in
// CI but for the environment's name.
export const e2eEnvironment = {
  APP_ENV: process.env.CI ? "ci" : "local",
  SIGNUP_ENABLED: "true",
  DATABASE_URL: e2eDatabase.appUrl,
  MAILER_ADAPTER: "file",
  VERCEL: "",
  // Better Auth starts the links of its e-mails with this address.
  BETTER_AUTH_URL: baseUrl,
};
