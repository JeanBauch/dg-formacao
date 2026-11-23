-- The first migration lays out a plain Postgres the same way on every host
-- (local, CI, Supabase or a restore target): the app schema for the
-- application, and the extensions schema, which Supabase already has, for the
-- extensions. drizzle-kit generated this file from the app schema, so its
-- snapshot knows app exists; the statements below were written by hand.
CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "extensions";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";
