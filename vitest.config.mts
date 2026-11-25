import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests that hit the database are named *.db.test.ts and run in their own
// project, one file at a time, after its global setup has prepared the test
// database. The other tests use no database and run in parallel.
const databaseTests = "src/**/*.db.test.ts";

// The data layer runs as server code, where Next.js resolves React with the
// `react-server` condition, and React scopes `cache` to the render of one
// request. The database tests resolve it the same way, both for the code Vite
// loads and for the packages Node loads, so a test can render Server
// Components in one request (NF-1). The other conditions are Vite's defaults.
const serverConditions = [
  "react-server",
  "module",
  "node",
  "development|production",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Next.js enforces `import 'server-only'` in its compiler; outside it the
    // package would throw, so the tests resolve it to an empty module.
    alias: { "server-only": resolve(import.meta.dirname, "src/test/empty.ts") },
  },
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
        ssr: { resolve: { conditions: serverConditions } },
        test: {
          name: "db",
          environment: "node",
          include: [databaseTests],
          globalSetup: ["./src/test/db/global-setup.ts"],
          setupFiles: ["./src/test/db/environment.ts"],
          fileParallelism: false,
          execArgv: ["--conditions=react-server"],
        },
      },
    ],
  },
});
