CREATE INDEX "bank_member_id_idx" ON "bank" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "account_bank_id_idx" ON "account" USING btree ("bank_id");--> statement-breakpoint
CREATE INDEX "scheduler_account_id_idx" ON "scheduler" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "operation_account_id_value_date_idx" ON "operation" USING btree ("account_id","value_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "operation_scheduler_id_value_date_idx" ON "operation" USING btree ("scheduler_id","value_date") WHERE "operation"."scheduler_id" is not null;--> statement-breakpoint
CREATE INDEX "operation_transfer_account_id_idx" ON "operation" USING btree ("transfer_account_id") WHERE "operation"."transfer_account_id" is not null;--> statement-breakpoint
CREATE INDEX "report_member_id_idx" ON "report" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "security_event_member_id_created_at_idx" ON "security_event" USING btree ("member_id","created_at");