import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests that hit the database are named *.db.test.ts and run in their own
// project, one file at a time, after its global setup has prepared the test
// database. The other tests use no database and run in parallel.
const databaseTests = "src/**/*.db.test.ts";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, databaseTests],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: [databaseTests],
          globalSetup: ["./src/test/db/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
