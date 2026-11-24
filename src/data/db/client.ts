import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

// The only database client (skill data-layer). DATABASE_URL is the transaction
// pooler in hosted environments, which rejects prepared statements.
export const db = drizzle({
  client: postgres(env.DATABASE_URL, { prepare: false }),
  schema,
});
