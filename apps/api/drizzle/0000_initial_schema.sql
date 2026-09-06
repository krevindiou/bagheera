CREATE TYPE "public"."entry_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."frequency_unit" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."period_grouping" AS ENUM('month', 'quarter', 'year', 'all');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('sum', 'average');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('sign_in_success', 'sign_in_failure', 'sign_in_throttled', 'sign_in_inactive', 'password_recovery_requested', 'password_recovery_completed', 'password_changed', 'email_change_requested', 'email_changed', 'activation_issued', 'activation_used', 'operation_batch_deleted', 'operation_batch_reconciled', 'scheduler_batch_deleted', 'report_batch_deleted', 'bank_closed', 'bank_deleted', 'account_closed', 'account_deleted', 'webauthn_credential_registered', 'webauthn_credential_removed', 'webauthn_sign_in_success', 'webauthn_sign_in_failure');--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(16) NOT NULL,
	"type" "entry_type"
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"parent_id" uuid,
	"type" "entry_type" NOT NULL,
	"name" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" varchar(128) NOT NULL,
	"password" varchar(255) NOT NULL,
	"country" varchar(2) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"logged_at" timestamp with time zone,
	"activation_token_version" integer DEFAULT 0 NOT NULL,
	"password_reset_token_version" integer DEFAULT 0 NOT NULL,
	"pending_email" varchar(128),
	"email_change_token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" varchar(32) NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"bank_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"transfer_account_id" uuid,
	"category_id" uuid,
	"payment_method_id" uuid NOT NULL,
	"third_party" varchar(64) NOT NULL,
	"debit" bigint,
	"credit" bigint,
	"value_date" date NOT NULL,
	"reconciled" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"limit_date" date,
	"frequency_unit" "frequency_unit" DEFAULT 'month' NOT NULL,
	"frequency_value" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduler_debit_credit_exclusive" CHECK (("scheduler"."debit" is null) <> ("scheduler"."credit" is null))
);
--> statement-breakpoint
CREATE TABLE "operation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"scheduler_id" uuid,
	"transfer_operation_id" uuid,
	"transfer_account_id" uuid,
	"category_id" uuid,
	"payment_method_id" uuid NOT NULL,
	"third_party" varchar(64) NOT NULL,
	"debit" bigint,
	"credit" bigint,
	"value_date" date DEFAULT now() NOT NULL,
	"reconciled" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_debit_credit_exclusive" CHECK (("operation"."debit" is null) <> ("operation"."credit" is null))
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "report_type" NOT NULL,
	"title" varchar(64) NOT NULL,
	"homepage" boolean DEFAULT false NOT NULL,
	"value_date_start" date,
	"value_date_end" date,
	"third_parties" varchar(255),
	"reconciled_only" boolean,
	"period_grouping" "period_grouping" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_account" (
	"report_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "report_account_report_id_account_id_pk" PRIMARY KEY("report_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "security_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid,
	"event_type" "security_event_type" NOT NULL,
	"source_address" varchar(45) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credential" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"device_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank" ADD CONSTRAINT "bank_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_bank_id_bank_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_transfer_account_id_account_id_fk" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_scheduler_id_scheduler_id_fk" FOREIGN KEY ("scheduler_id") REFERENCES "public"."scheduler"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_transfer_operation_id_operation_id_fk" FOREIGN KEY ("transfer_operation_id") REFERENCES "public"."operation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_transfer_account_id_account_id_fk" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_account" ADD CONSTRAINT "report_account_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_account" ADD CONSTRAINT "report_account_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credential" ADD CONSTRAINT "webauthn_credential_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_email_unique" ON "member" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "operation_transfer_operation_id_unique" ON "operation" USING btree ("transfer_operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credential_credential_id_unique" ON "webauthn_credential" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_credential_member_id_idx" ON "webauthn_credential" USING btree ("member_id");