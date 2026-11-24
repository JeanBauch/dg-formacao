CREATE TYPE "app"."security_event" AS ENUM('sign_in_succeeded', 'sign_in_failed', 'staff_sign_in_succeeded', 'password_reset_requested', 'password_reset_completed', 'rate_limited', 'account_locked', 'access_denied');--> statement-breakpoint
CREATE TABLE "app"."security_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event" "app"."security_event" NOT NULL,
	"user_id" text,
	"ip" "inet",
	"user_agent" varchar(256),
	"route" text NOT NULL,
	"details" jsonb,
	"count" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"last_at" timestamp with time zone NOT NULL,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_events_first_at_idx" ON "app"."security_events" USING btree ("first_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_events_dedupe_key_idx" ON "app"."security_events" USING btree ("dedupe_key");