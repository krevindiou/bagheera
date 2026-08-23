ALTER TYPE "public"."security_event_type" ADD VALUE 'sign_in_inactive' BEFORE 'password_recovery_requested';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'bank_closed';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'bank_deleted';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'account_closed';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'account_deleted';