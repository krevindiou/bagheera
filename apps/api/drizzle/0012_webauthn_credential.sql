ALTER TYPE "public"."security_event_type" ADD VALUE 'webauthn_credential_registered';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'webauthn_credential_removed';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'webauthn_sign_in_success';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'webauthn_sign_in_failure';--> statement-breakpoint
CREATE TABLE "webauthn_credential" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"device_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "webauthn_credential" ADD CONSTRAINT "webauthn_credential_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credential_credential_id_unique" ON "webauthn_credential" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_credential_member_id_idx" ON "webauthn_credential" USING btree ("member_id");