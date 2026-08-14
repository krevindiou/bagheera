import { z } from "zod";
import { TRANSFER_PAYMENT_METHOD_IDS } from "../operations/operations.types";

const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().int().positive().optional(),
);

// Field rules mirror the API DTOs (apps/api/src/schedulers/dto/*) — the
// same recurring-fields-on-top-of-an-operation shape as operationSchema,
// plus the recurrence config (limitDate/frequencyUnit/frequencyValue/active).
export const schedulerSchema = z
  .object({
    type: z.enum(["debit", "credit"]),
    thirdParty: z.string().trim().min(1).max(64),
    amount: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
      z.number().positive(),
    ),
    categoryId: optionalId,
    paymentMethodId: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
      z.number().int().positive(),
    ),
    transferAccountId: optionalId,
    valueDate: z.string().min(1),
    notes: z.string().max(4096).optional(),
    reconciled: z.boolean().optional(),
    limitDate: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().optional(),
    ),
    frequencyUnit: z.enum(["day", "week", "month", "year"]),
    frequencyValue: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
      z.number().int().positive(),
    ),
    active: z.boolean().optional(),
  })
  .refine(
    (form) => !TRANSFER_PAYMENT_METHOD_IDS.includes(form.paymentMethodId) || Boolean(form.transferAccountId),
    { message: "transferAccountRequired", path: ["transferAccountId"] },
  );
export type SchedulerForm = z.infer<typeof schedulerSchema>;
