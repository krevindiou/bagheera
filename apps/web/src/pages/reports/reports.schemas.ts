import { MAX_SIGNIFICANT_RESULTS_NUMBER } from '../../domain/referenceData';
import { DATA_GROUPINGS, PERIOD_GROUPINGS, REPORT_TYPES } from '@bagheera/reference-data';
import { z } from 'zod';

const optionalDate = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

// Field rules mirror the API DTOs.
export const reportSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    title: z.string().trim().min(1).max(64),
    homepage: z.boolean().optional(),
    valueDateStart: optionalDate,
    valueDateEnd: optionalDate,
    thirdParties: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().max(255).optional(),
    ),
    accountIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    reconciledOnly: z.boolean().optional(),
    periodGrouping: z.enum(PERIOD_GROUPINGS),
    dataGrouping: z.enum(DATA_GROUPINGS).optional(),
    significantResultsNumber: z
      .number()
      .int()
      .min(1)
      .max(MAX_SIGNIFICANT_RESULTS_NUMBER)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'distribution') {
      if (!value.dataGrouping) {
        ctx.addIssue({ code: 'custom', path: ['dataGrouping'], message: 'Required' });
      }
      if (value.significantResultsNumber === undefined) {
        ctx.addIssue({ code: 'custom', path: ['significantResultsNumber'], message: 'Required' });
      }
    }
    // Mirrors the API's IsOnOrAfter.
    if (value.valueDateStart && value.valueDateEnd && value.valueDateEnd < value.valueDateStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['valueDateEnd'],
        message: 'End date must be on or after the start date',
      });
    }
  });
export type ReportForm = z.infer<typeof reportSchema>;
