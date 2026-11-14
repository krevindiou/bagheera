CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "operation_third_party_trgm_idx" ON "operation" USING gin ("third_party" gin_trgm_ops);
