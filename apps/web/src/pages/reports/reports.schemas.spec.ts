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

  it('requires periodGrouping for every type', () => {
    const result = reportSchema.safeParse({ ...base, periodGrouping: undefined });
    expect(result.success).toBe(false);
  });

  describe('distribution reports', () => {
    const distributionBase = {
      type: 'distribution' as const,
      title: 'Spending by category',
      dataGrouping: 'category' as const,
      significantResultsNumber: 5,
      periodGrouping: 'all' as const,
    };

    it('accepts a minimal valid distribution report', () => {
      expect(reportSchema.safeParse(distributionBase).success).toBe(true);
    });

    it('also requires periodGrouping for a distribution report', () => {
      const result = reportSchema.safeParse({ ...distributionBase, periodGrouping: undefined });
      expect(result.success).toBe(false);
    });

    it('accepts a distribution report grouped by month', () => {
      expect(reportSchema.safeParse({ ...distributionBase, periodGrouping: 'month' }).success).toBe(
        true,
      );
    });

    it('rejects a distribution report missing dataGrouping', () => {
      const result = reportSchema.safeParse({
        ...distributionBase,
        dataGrouping: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('rejects a distribution report missing significantResultsNumber', () => {
      const result = reportSchema.safeParse({
        ...distributionBase,
        significantResultsNumber: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('rejects a significantResultsNumber outside 1..50', () => {
      expect(
        reportSchema.safeParse({ ...distributionBase, significantResultsNumber: 0 }).success,
      ).toBe(false);
      expect(
        reportSchema.safeParse({ ...distributionBase, significantResultsNumber: 51 }).success,
      ).toBe(false);
    });

    it('rejects an invalid dataGrouping', () => {
      expect(reportSchema.safeParse({ ...distributionBase, dataGrouping: 'invalid' }).success).toBe(
        false,
      );
    });
  });
});
