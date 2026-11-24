import { pgSchema } from "drizzle-orm/pg-core";

// Every table, enum and index of the application lives in the app schema
// (ADR-009, item 3).
export const app = pgSchema("app");
