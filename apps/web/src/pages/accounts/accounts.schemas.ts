import { z } from "zod";

// Field rules mirror the API DTOs (apps/api/src/{banks,accounts}/dto/*).
const accountName = z.string().trim().min(1).max(64);
const currency = z.string().trim().length(3);

export const editBankSchema = z.object({
  name: z.string().trim().min(1).max(32),
});
export type EditBankForm = z.infer<typeof editBankSchema>;

export const editAccountSchema = z.object({
  name: accountName,
});
export type EditAccountForm = z.infer<typeof editAccountSchema>;

// Spec 4.7: the bank-choice step (its own screen) offers two mutually
// exclusive options — pick an existing active bank (bankId) or type a new
// bank's name (bankName) — before account creation (4.8) even starts.
export const bankChoiceSchema = z
  .object({
    bankId: z.union([z.number(), z.string()]).optional(),
    bankName: z.string().trim().max(32).optional(),
  })
  .refine((form) => Boolean(form.bankId) !== Boolean(form.bankName), {
    message: "bankChoiceRequired",
    path: ["bankName"],
  });
export type BankChoiceForm = z.infer<typeof bankChoiceSchema>;

// Spec 4.8: account creation, pre-scoped to the bank chosen/created above
// (the bank field stays editable — a dropdown of the member's active
// banks — but starts pre-selected to that bank).
export const createAccountSchema = z.object({
  bankId: z
    .union([z.number(), z.string()])
    .refine((value) => value !== "" && value !== undefined && value !== null, {
      message: "required",
    }),
  name: accountName,
  currency,
  initialBalance: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === null ? undefined : Number(value),
    z.number().optional(),
  ),
});
export type CreateAccountForm = z.infer<typeof createAccountSchema>;
