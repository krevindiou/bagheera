import { z } from 'zod';

// Field rules mirror the API DTOs (apps/api/src/{banks,accounts}/dto/*).
const accountName = z.string().trim().min(1).max(64);
const currency = z
  .string()
  .trim()
  .refine((code) => Intl.supportedValuesOf('currency').includes(code));

export const editBankSchema = z.object({
  name: z.string().trim().min(1).max(32),
});
export type EditBankForm = z.infer<typeof editBankSchema>;

export const editAccountSchema = z.object({
  name: accountName,
});

// Either an existing bank (bankId) or a new one's name (bankName).
export const bankChoiceSchema = z
  .object({
    bankId: z.string().optional(),
    bankName: z.string().trim().max(32).optional(),
  })
  .refine((form) => Boolean(form.bankId) !== Boolean(form.bankName), {
    message: 'bankChoiceRequired',
    path: ['bankName'],
  });
export type BankChoiceForm = z.infer<typeof bankChoiceSchema>;

export const createAccountSchema = z.object({
  bankId: z.string().min(1, 'required'),
  name: accountName,
  currency,
  initialBalance: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z.number().optional(),
  ),
});
export type CreateAccountForm = z.infer<typeof createAccountSchema>;
