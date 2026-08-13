CREATE TYPE "public"."frequency_unit" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TABLE "scheduler" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"transfer_account_id" integer,
	"category_id" integer,
	"payment_method_id" integer NOT NULL,
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
ALTER TABLE "operation" ADD COLUMN "scheduler_id" integer;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_transfer_account_id_account_id_fk" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_scheduler_id_scheduler_id_fk" FOREIGN KEY ("scheduler_id") REFERENCES "public"."scheduler"("id") ON DELETE no action ON UPDATE no action;