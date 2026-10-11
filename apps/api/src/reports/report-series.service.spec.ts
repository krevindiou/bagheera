import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import { computeAxisBounds } from '../common/chart-axis';
import type { report } from '../db/schema';
import type { OwnershipService } from '../security/ownership.service';
import { ReportSeriesService } from './report-series.service';
import { currentYearStart } from './report-periods';

vi.mock('./effective-accounts', () => ({
  effectiveAccounts: vi.fn().mockResolvedValue([{ id: 'account-1', currency: 'EUR' }]),
}));
vi.mock('./effective-categories', () => ({
  effectiveCategoryIds: vi.fn().mockResolvedValue([]),
}));

interface Row {
  currency: string;
  period: string | null;
  debitSum: string | null;
  debitCount: string;
  creditSum: string | null;
  creditCount: string;
}

// The aggregate query's chain, resolving to `rows` at its final `.groupBy()`.
function fakeDb(rows: Row[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  return { select: vi.fn().mockReturnValue(query) } as unknown as NodePgDatabase;
}

function credit(currency: string, period: string | null, sum: number, count = 1): Row {
  return {
    currency,
    period,
    debitSum: null,
    debitCount: '0',
    creditSum: String(sum),
    creditCount: String(count),
  };
}

function reportOf(
  type: 'sum' | 'average',
  periodGrouping: 'all' | 'month' | 'quarter' | 'year',
): typeof report.$inferSelect {
  return {
    id: 'report-1',
    type,
    periodGrouping,
    valueDateStart: null,
    valueDateEnd: null,
    thirdParties: null,
    reconciledOnly: false,
  } as typeof report.$inferSelect;
}

function serviceFor(rows: Row[]) {
  return new ReportSeriesService(fakeDb(rows), {} as OwnershipService);
}

describe('ReportSeriesService.computeSeries', () => {
  it('fills every currency over the same period range', async () => {
    const service = serviceFor([
      credit('USD', '2026-01-01', 100),
      credit('USD', '2026-04-01', 400),
      credit('EUR', '2026-03-01', 30),
    ]);

    const result = await service.computeSeries(reportOf('sum', 'month'), 'member-1');

    const months = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'];
    expect(result.series.map((s) => s.currency)).toEqual(['EUR', 'USD']);
    for (const entry of result.series) {
      expect(entry.credit.map((p) => p.period)).toEqual(months);
      expect(entry.debit.map((p) => p.period)).toEqual(months);
    }
    const [eur, usd] = result.series;
    expect(eur.credit.map((p) => p.value)).toEqual([0, 0, 30, 0]);
    expect(usd.credit.map((p) => p.value)).toEqual([100, 0, 0, 400]);
    expect(result.axisBounds).toEqual(computeAxisBounds(0, 400));
  });

  it('averages each bucket over its operation count', async () => {
    const service = serviceFor([credit('EUR', '2026-01-01', 90, 3)]);

    const result = await service.computeSeries(reportOf('average', 'quarter'), 'member-1');

    expect(result.series[0].credit).toEqual([{ period: '2026-01-01', value: 30 }]);
  });

  it("keeps a single bucket per currency for 'all'", async () => {
    const service = serviceFor([credit('EUR', null, 10), credit('USD', null, 20)]);

    const result = await service.computeSeries(reportOf('sum', 'all'), 'member-1');

    expect(result.series.map((s) => s.credit)).toEqual([
      [{ period: currentYearStart(), value: 10 }],
      [{ period: currentYearStart(), value: 20 }],
    ]);
  });

  it('is hidden when no operation matches', async () => {
    const result = await serviceFor([]).computeSeries(reportOf('sum', 'month'), 'member-1');

    expect(result).toEqual({ hidden: true, axisBounds: null, series: [] });
  });
});
