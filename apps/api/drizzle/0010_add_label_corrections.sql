ALTER TYPE "public"."security_event_type" ADD VALUE 'label_corrections_deleted' BEFORE 'scheduler_batch_deleted';--> statement-breakpoint
CREATE TABLE "label_correction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"source_label" varchar(4096) NOT NULL,
	"third_party" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operation" ADD COLUMN "source_label" varchar(4096);--> statement-breakpoint
ALTER TABLE "label_correction" ADD CONSTRAINT "label_correction_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "label_correction_member_id_source_label_unique" ON "label_correction" USING btree ("member_id",lower("source_label"));