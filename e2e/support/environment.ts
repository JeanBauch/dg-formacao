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

// A second server of the same build, on the next port, started with the
// public sign-up closed (A2.20). Only the sign-up page's test goes to it.
export const closedSignUpPort = port + 1;

export const closedSignUpUrl = `http://localhost:${closedSignUpPort}`;

export const closedSignUpEnvironment = {
  ...e2eEnvironment,
  SIGNUP_ENABLED: "false",
  BETTER_AUTH_URL: closedSignUpUrl,
};

// A third server of the same build, on the port after that, whose database is
// out of reach: one the container does not have. It shares the first server's
// secret, so the seed's holder's cookie gets past its edge and its session
// gate, which then fails to read the session. Only the private area's error
// test goes to it.
export const databaseDownPort = port + 2;

export const databaseDownUrl = `http://localhost:${databaseDownPort}`;

export const databaseDownEnvironment = {
  ...e2eEnvironment,
  DATABASE_URL: `${e2eDatabase.appUrl}_inexistente`,
  BETTER_AUTH_URL: databaseDownUrl,
};
