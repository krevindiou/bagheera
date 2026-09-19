import { z } from 'zod';

const optionalDate = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

// A distribution report ranks buckets by amount and shows at most this many
// individually before collapsing the rest into "Other" — mirrors the API's
// MAX_SIGNIFICANT_RESULTS_NUMBER (apps/api/src/reports/dto/create-report.dto.ts).
export const MAX_SIGNIFICANT_RESULTS_NUMBER = 50;

// Field rules mirror the API DTOs (apps/api/src/reports/dto/*): periodGrouping
// is required for every type — a 'distribution' report ranks *within* each
// period too, defaulting to 'all' (a single whole-range bucket).
// dataGrouping/significantResultsNumber are required for 'distribution' only.
export const reportSchema = z
  .object({
    type: z.enum(['sum', 'average', 'distribution']),
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
    periodGrouping: z.enum(['month', 'quarter', 'year', 'all']),
    dataGrouping: z.enum(['category', 'third_party', 'payment_method']).optional(),
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
    // Mirrors the API's IsOnOrAfter check on valueDateEnd — an inverted
    // range otherwise matches no operations and the report just renders
    // empty, with nothing telling the member why.
    if (value.valueDateStart && value.valueDateEnd && value.valueDateEnd < value.valueDateStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['valueDateEnd'],
        message: 'End date must be on or after the start date',
      });
    }
  });
export type ReportForm = z.infer<typeof reportSchema>;
