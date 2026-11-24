import { testDatabase } from "./test-database";

// Runs before each database test file imports anything: the configuration the
// code under test validates when it loads, with the fictitious local values.
// It connects to the test database as the application role, so the database's
// refusals are real.
Object.assign(process.env, {
  APP_ENV: "ci",
  SIGNUP_ENABLED: "true",
  DATABASE_URL: testDatabase.appUrl,
  MAILER_ADAPTER: "file",
  VERCEL: "",
});
