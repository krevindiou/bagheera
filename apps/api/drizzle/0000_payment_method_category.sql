CREATE TYPE "public"."entry_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(16) NOT NULL,
	"type" "entry_type"
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"type" "entry_type" NOT NULL,
	"name" varchar(32) NOT NULL,
	"is_salary_category" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;