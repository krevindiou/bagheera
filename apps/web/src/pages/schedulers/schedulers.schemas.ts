import { AMOUNT_CEILING } from '@bagheera/money';
import { z } from 'zod';
import { valueDateSchema, type FormValues } from '../operations/operations.schemas';
import { TRANSFER_PAYMENT_METHOD_IDS } from '../../domain/referenceData';
import { ENTRY_TYPES, FREQUENCY_UNITS } from '@bagheera/reference-data';

const optionalId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.string().uuid().optional(),
);

// Field rules mirror the API DTOs: operationSchema's plus recurrence.
export const schedulerSchema = z
  .object({
    type: z.enum(ENTRY_TYPES),
    thirdParty: z.string().trim().min(1).max(64),
    amount: z.preprocess(
      (value) =>
        value === '' || value === undefined || value === null ? undefined : Number(value),
      z.number().positive().max(AMOUNT_CEILING),
    ),
    categoryId: optionalId,
    paymentMethodId: z.string().uuid(),
    transferAccountId: optionalId,
    valueDate: valueDateSchema,
    notes: z.string().max(4096).optional(),
    reconciled: z.boolean().optional(),
    limitDate: z.preprocess(
      (value) => (value === '' ? undefined : value),
      valueDateSchema.optional(),
    ),
    frequencyUnit: z.enum(FREQUENCY_UNITS),
    frequencyValue: z.preprocess(
      (value) =>
        value === '' || value === undefined || value === null ? undefined : Number(value),
      z.number().int().positive(),
    ),
    active: z.boolean().optional(),
  })
  .refine(
    (form) =>
      !TRANSFER_PAYMENT_METHOD_IDS.includes(form.paymentMethodId) ||
      Boolean(form.transferAccountId),
    { message: 'transferAccountRequired', path: ['transferAccountId'] },
  );
export type SchedulerForm = z.infer<typeof schedulerSchema>;
export type SchedulerFormValues = FormValues<SchedulerForm>;
