ALTER TYPE "public"."security_event_type" ADD VALUE 'signup_confirmation_issued';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'passkey_signup_completed';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'step_up_verified';--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "active";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "activation_token_version";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "password_reset_token_version";