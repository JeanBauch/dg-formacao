import { pgSchema } from "drizzle-orm/pg-core";

// Every table, enum and index of the application lives in the app schema
// (ADR-009, item 3). drizzle-kit reads this file, so it must not import
// server-only code.
export const app = pgSchema("app");
