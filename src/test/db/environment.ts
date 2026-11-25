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

// The security log's daily cap keeps its default, whatever the developer's shell
// exports; a file that tests another cap sets its own after this runs. The key
// is deleted, as assigning undefined would store the text "undefined".
delete process.env.SECURITY_EVENTS_DAILY_CAP;
