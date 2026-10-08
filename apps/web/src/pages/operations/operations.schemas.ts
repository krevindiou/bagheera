import { AMOUNT_CEILING } from '@bagheera/money';
import { z } from 'zod';

const optionalId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.string().uuid().optional(),
);

// Field rules mirror the API DTOs. An empty transfer account means
// "External account" (no mirror).
export const operationSchema = z.object({
  type: z.enum(['debit', 'credit']),
  thirdParty: z.string().trim().min(1).max(64),
  amount: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z.number().positive().max(AMOUNT_CEILING),
  ),
  categoryId: optionalId,
  paymentMethodId: z.string().uuid(),
  transferAccountId: optionalId,
  valueDate: z.string().min(1),
  notes: z.string().max(4096).optional(),
  reconciled: z.boolean().optional(),
});
export type OperationForm = z.infer<typeof operationSchema>;

// Form state, not the validated payload: amount and payment method start
// `undefined`.
export type FormValues<T extends { amount: number; paymentMethodId: string }> = Omit<
  T,
  'amount' | 'paymentMethodId'
> & { amount: number | undefined; paymentMethodId: string | undefined };
export type OperationFormValues = FormValues<OperationForm>;
