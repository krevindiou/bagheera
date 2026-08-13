CREATE TYPE "public"."period_grouping" AS ENUM('month', 'quarter', 'year', 'all');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('sum', 'average');--> statement-breakpoint
CREATE TABLE "report" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
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
	"report_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	CONSTRAINT "report_account_report_id_account_id_pk" PRIMARY KEY("report_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_account" ADD CONSTRAINT "report_account_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_account" ADD CONSTRAINT "report_account_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;