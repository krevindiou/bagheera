import { z } from "zod";

const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

// Field rules mirror the API DTOs (apps/api/src/reports/dto/*).
export const reportSchema = z.object({
  type: z.enum(["sum", "average"]),
  title: z.string().trim().min(1).max(64),
  homepage: z.boolean().optional(),
  valueDateStart: optionalDate,
  valueDateEnd: optionalDate,
  thirdParties: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().max(255).optional(),
  ),
  accountIds: z.array(z.number()).optional(),
  reconciledOnly: z.boolean().optional(),
  periodGrouping: z.enum(["month", "quarter", "year", "all"]),
});
export type ReportForm = z.infer<typeof reportSchema>;
