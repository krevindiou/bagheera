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

// The bank-choice step offers two mutually exclusive options: pick an
// existing active bank (bankId) or type a new bank's name (bankName).
export const createAccountSchema = z
  .object({
    bankId: z.union([z.number(), z.string()]).optional(),
    bankName: z.string().trim().max(32).optional(),
    name: accountName,
    currency,
    initialBalance: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
      z.number().optional(),
    ),
  })
  .refine((form) => Boolean(form.bankId) !== Boolean(form.bankName), {
    message: "bankChoiceRequired",
    path: ["bankName"],
  });
export type CreateAccountForm = z.infer<typeof createAccountSchema>;
