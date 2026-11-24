import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/data/db/schema/index.ts",
  out: "./drizzle",
  // Keeps drizzle-kit away from the schemas the host manages (Supabase's own).
  schemaFilter: ["app"],
  // The log of applied migrations lives in app: the backup copies only app, and
  // a restored database still knows which migrations ran (ADR-009, item 3).
  migrations: { schema: "app" },
  // The migrations role, over a session connection (never the transaction pooler).
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? "" },
  strict: true,
});
