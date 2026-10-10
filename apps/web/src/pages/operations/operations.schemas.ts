import { AMOUNT_CEILING } from '@bagheera/money';
import { z } from 'zod';
import { ENTRY_TYPES, isValueDate } from '@bagheera/reference-data';

const optionalId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.string().uuid().optional(),
);

// A date inside the API's MIN_VALUE_DATE..MAX_VALUE_DATE range.
export const valueDateSchema = z.string().refine(isValueDate);

// Field rules mirror the API DTOs. An empty transfer account means
// "External account" (no mirror).
export const operationSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  thirdParty: z.string().trim().min(1).max(64),
  amount: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z.number().positive().max(AMOUNT_CEILING),
  ),
  categoryId: optionalId,
  paymentMethodId: z.string().uuid(),
  transferAccountId: optionalId,
  valueDate: valueDateSchema,
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
