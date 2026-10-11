import { z } from 'zod';
import { FIELD_LIMITS, FREQUENCY_UNITS } from '@bagheera/reference-data';
import {
  operationSchema,
  valueDateSchema,
  type FormValues,
} from '../operations/operations.schemas';

// Field rules mirror the API DTOs: operationSchema's plus recurrence.
export const schedulerSchema = operationSchema.extend({
  limitDate: z.preprocess(
    (value) => (value === '' ? undefined : value),
    valueDateSchema.optional(),
  ),
  frequencyUnit: z.enum(FREQUENCY_UNITS),
  frequencyValue: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z.number().int().positive().max(FIELD_LIMITS.FREQUENCY_VALUE),
  ),
  active: z.boolean().optional(),
});
export type SchedulerForm = z.infer<typeof schedulerSchema>;
export type SchedulerFormValues = FormValues<SchedulerForm>;
