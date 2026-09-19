CREATE TABLE "report_category" (
	"report_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "report_category_report_id_category_id_pk" PRIMARY KEY("report_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "report_category" ADD CONSTRAINT "report_category_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_category" ADD CONSTRAINT "report_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;