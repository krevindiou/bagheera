CREATE TYPE "public"."security_event_type" AS ENUM('sign_in_success', 'sign_in_failure', 'sign_in_throttled', 'password_recovery_requested', 'password_recovery_completed', 'password_changed', 'email_changed', 'activation_issued', 'activation_used');--> statement-breakpoint
CREATE TABLE "security_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"event_type" "security_event_type" NOT NULL,
	"source_address" varchar(45) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;