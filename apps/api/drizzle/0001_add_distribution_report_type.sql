CREATE TYPE "public"."data_grouping" AS ENUM('category', 'third_party', 'payment_method');--> statement-breakpoint
ALTER TYPE "public"."report_type" ADD VALUE 'distribution';--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN "data_grouping" "data_grouping";--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN "significant_results_number" integer;
