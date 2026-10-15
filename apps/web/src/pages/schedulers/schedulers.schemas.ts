import { z } from 'zod';
import { FIELD_LIMITS, FREQUENCY_UNITS } from '@bagheera/reference-data';
import {
  operationSchema,
  valueDateSchema,
  type FormValues,
} from '../operations/operations.schemas';

// Field rules mirror the API DTOs: operationSchema's plus recurrence.
export const schedulerSchema = operationSchema
  .extend({
    limitDate: z.preprocess(
      (value) => (value === '' ? undefined : value),
      valueDateSchema.optional(),
    ),
    frequencyUnit: z.enum(FREQUENCY_UNITS),
    frequencyValue: z.preprocess(
      (value) =>
        value === '' || value === undefined || value === null ? undefined : Number(value),
      z.number().int().positive().max(FIELD_LIMITS.FREQUENCY_VALUE),
    ),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // Mirrors the API's IsOnOrAfter — an inverted pair would stop the
    // scheduler before it ever runs.
    if (value.limitDate && value.limitDate < value.valueDate) {
      ctx.addIssue({ code: 'custom', path: ['limitDate'], message: 'beforeValueDate' });
    }
  });
export type SchedulerForm = z.infer<typeof schedulerSchema>;
export type SchedulerFormValues = FormValues<SchedulerForm>;
