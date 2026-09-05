ALTER TYPE "public"."security_event_type" ADD VALUE 'email_change_requested' BEFORE 'email_changed';--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "pending_email" varchar(128);--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "email_change_token_version" integer DEFAULT 0 NOT NULL;