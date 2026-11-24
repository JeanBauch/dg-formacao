CREATE TYPE "app"."consent_document" AS ENUM('terms_of_use', 'privacy_policy', 'adult_declaration');--> statement-breakpoint
CREATE TABLE "app"."consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document" "app"."consent_document" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."consents" ADD CONSTRAINT "consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consents_user_id_idx" ON "app"."consents" USING btree ("user_id");