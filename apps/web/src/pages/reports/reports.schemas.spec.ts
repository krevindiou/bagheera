import { describe, expect, it } from 'vitest';
import { reportSchema } from './reports.schemas';

const base = {
  type: 'sum' as const,
  title: 'Monthly spend',
  periodGrouping: 'month' as const,
};

describe('reportSchema', () => {
  it('accepts a minimal valid report', () => {
    expect(reportSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(reportSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('rejects an invalid type or periodGrouping', () => {
    expect(reportSchema.safeParse({ ...base, type: 'invalid' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, periodGrouping: 'invalid' }).success).toBe(false);
  });

  it('treats an empty-string date range as omitted', () => {
    const result = reportSchema.safeParse({ ...base, valueDateStart: '', valueDateEnd: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valueDateStart).toBeUndefined();
      expect(result.data.valueDateEnd).toBeUndefined();
    }
  });

  it('treats an empty-string thirdParties filter as omitted', () => {
    const result = reportSchema.safeParse({ ...base, thirdParties: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.thirdParties).toBeUndefined();
  });

  it('accepts the optional accountIds/homepage/reconciledOnly flags', () => {
    expect(
      reportSchema.safeParse({
        ...base,
        homepage: true,
        reconciledOnly: true,
        accountIds: ['a1', 'a2'],
      }).success,
    ).toBe(true);
  });
});
