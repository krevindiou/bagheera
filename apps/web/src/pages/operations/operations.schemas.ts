import { z } from "zod";

const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().int().positive().optional(),
);

// Field rules mirror the API DTOs (apps/api/src/operations/dto/*). The
// transfer account is optional even for a transfer payment method: leaving
// it empty means the "External account" placeholder (a plain transfer with
// no mirrored operation on another of the member's accounts).
export const operationSchema = z.object({
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
});
export type OperationForm = z.infer<typeof operationSchema>;
