CREATE TABLE "app"."sign_in_failures" (
	"user_id" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"last_failed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."sign_in_failures" ADD CONSTRAINT "sign_in_failures_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;