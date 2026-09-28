ALTER TABLE "scheduler" ADD COLUMN "last_generated_date" date;--> statement-breakpoint
-- Backfill the cursor from whatever generated operations survive today —
-- the best available approximation, since deletions/edits before this
-- migration already lost the true history.
UPDATE "scheduler" s SET "last_generated_date" = sub.max_value_date
FROM (
  SELECT "scheduler_id", MAX("value_date") AS max_value_date
  FROM "operation"
  WHERE "scheduler_id" IS NOT NULL
  GROUP BY "scheduler_id"
) sub
WHERE sub."scheduler_id" = s.id;