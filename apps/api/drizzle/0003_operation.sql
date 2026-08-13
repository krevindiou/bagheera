CREATE TABLE "operation" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"transfer_operation_id" integer,
	"transfer_account_id" integer,
	"category_id" integer,
	"payment_method_id" integer NOT NULL,
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
ALTER TABLE "operation" ADD CONSTRAINT "operation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_transfer_operation_id_operation_id_fk" FOREIGN KEY ("transfer_operation_id") REFERENCES "public"."operation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_transfer_account_id_account_id_fk" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation" ADD CONSTRAINT "operation_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operation_transfer_operation_id_unique" ON "operation" USING btree ("transfer_operation_id");