CREATE TABLE "account_statement" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_statement" ADD CONSTRAINT "account_statement_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_statement_fingerprint_idx" ON "account_statement" USING btree ("fingerprint");