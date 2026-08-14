// The scheduler controllers return plain rows (no @ApiOkResponse DTOs), so
// the generated API client types their bodies as `Record<string, never>`.
// This mirrors the actual shape (apps/api/src/db/schema/scheduler.ts).
export interface Scheduler {
  id: number;
  accountId: number;
  transferAccountId: number | null;
  categoryId: number | null;
  paymentMethodId: number;
  thirdParty: string;
  // Minor units (real value × 10,000); exactly one of debit/credit is set.
  debit: number | null;
  credit: number | null;
  valueDate: string;
  reconciled: boolean;
  notes: string;
  limitDate: string | null;
  frequencyUnit: "day" | "week" | "month" | "year";
  frequencyValue: number;
  active: boolean;
}

export interface SchedulerList {
  items: Scheduler[];
  total: number;
  page: number;
  pageSize: number;
}
