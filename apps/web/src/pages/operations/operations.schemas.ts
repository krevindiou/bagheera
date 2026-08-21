import { z } from "zod";
import { TRANSFER_PAYMENT_METHOD_IDS } from "./operations.types";

const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().int().positive().optional(),
);

// Field rules mirror the API DTOs (apps/api/src/operations/dto/*).
export const operationSchema = z
  .object({
    type: z.enum(["debit", "credit"]),
    thirdParty: z.string().trim().min(1).max(64),
    amount: z.preprocess(
      (value) =>
        value === "" || value === undefined || value === null ? undefined : Number(value),
      z.number().positive(),
    ),
    categoryId: optionalId,
    paymentMethodId: z.preprocess(
      (value) =>
        value === "" || value === undefined || value === null ? undefined : Number(value),
      z.number().int().positive(),
    ),
    transferAccountId: optionalId,
    valueDate: z.string().min(1),
    notes: z.string().max(4096).optional(),
    reconciled: z.boolean().optional(),
  })
  .refine(
    (form) =>
      !TRANSFER_PAYMENT_METHOD_IDS.includes(form.paymentMethodId) ||
      Boolean(form.transferAccountId),
    { message: "transferAccountRequired", path: ["transferAccountId"] },
  );
export type OperationForm = z.infer<typeof operationSchema>;
