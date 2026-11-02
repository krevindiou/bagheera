import { HttpStatus } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { report } from '../db/schema';
import type { MemberId } from '../security/ids';
import type { InFlightLimiter } from '../security/in-flight-limiter';
import type { OwnershipService } from '../security/ownership.service';
import type {
  ReportDistribution,
  ReportDistributionService,
} from '../reports/report-distribution.service';
import type { ReportSeries, ReportSeriesService } from '../reports/report-series.service';
import {
  DASHBOARD_IN_FLIGHT,
  DashboardService,
  HOMEPAGE_REPORT_CONCURRENCY,
} from './dashboard.service';

// Everything the dashboard reads besides its homepage reports comes back empty.
vi.mock('../common/balances', () => ({ balancesByAccount: vi.fn().mockResolvedValue(new Map()) }));
vi.mock('../common/member-today', () => ({ memberToday: vi.fn().mockResolvedValue('2026-06-15') }));
vi.mock('../common/monthly-net', () => ({
  monthlyNetByAccount: vi.fn().mockResolvedValue([]),
  toSynthesisChartRow: vi.fn(),
}));
vi.mock('../security/reachable', () => ({
  reachableAccountsOf: vi.fn(),
  isFullyActive: vi.fn().mockReturnValue(true),
}));

const memberId = 'member-1' as MemberId;

type Report = typeof report.$inferSelect;

function reportOf(id: string, type: Report['type']): Report {
  return { id, type, title: id, periodGrouping: 'month' } as Report;
}

// The accounts select (ending in `.orderBy()`), then the homepage reports one
// (ending in `.where()`).
function fakeDb(homepageReports: Report[]): NodePgDatabase {
  const accounts = {
    from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }),
  };
  const reports = { from: () => ({ where: () => Promise.resolve(homepageReports) }) };
  return {
    select: vi.fn().mockReturnValueOnce(accounts).mockReturnValueOnce(reports),
  } as unknown as NodePgDatabase;
}

const passThroughLimiter = {
  run: (_key: string, _limit: unknown, _onBusy: () => Error, work: () => Promise<unknown>) =>
    work(),
} as unknown as InFlightLimiter;

// Report computations that settle only when the test says so, counting how
// many run at once across both kinds.
function controlledComputations() {
  let active = 0;
  let maxActive = 0;
  const pending: (() => void)[] = [];
  function track<T>(value: T): Promise<T> {
    active++;
    maxActive = Math.max(maxActive, active);
    return new Promise<T>((resolve) => {
      pending.push(() => {
        active--;
        resolve(value);
      });
    });
  }
  const series: ReportSeries = { hidden: false, axisBounds: null, series: [] };
  const distribution: ReportDistribution = {
    hidden: false,
    dataGrouping: 'category',
    series: [],
  };
  const computeSeries = vi.fn(() => track(series));
  const computeDistribution = vi.fn(() => track(distribution));
  return {
    reportSeries: { computeSeries } as unknown as ReportSeriesService,
    reportDistributions: { computeDistribution } as unknown as ReportDistributionService,
    computeSeries,
    computeDistribution,
    pending,
    maxActive: () => maxActive,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function ownershipWithOneBank() {
  const listOwnedBanks = vi.fn().mockResolvedValue([{ id: 'bank-1', name: 'Bank', closed: false }]);
  return { ownership: { listOwnedBanks } as unknown as OwnershipService, listOwnedBanks };
}

describe('DashboardService.getDashboard', () => {
  it('never computes more than HOMEPAGE_REPORT_CONCURRENCY homepage reports at once, series and distributions alike', async () => {
    const homepageReports = Array.from({ length: 7 }, (_, i) =>
      reportOf(`report-${i}`, i % 2 === 0 ? 'distribution' : 'sum'),
    );
    const computations = controlledComputations();
    const service = new DashboardService(
      fakeDb(homepageReports),
      ownershipWithOneBank().ownership,
      computations.reportSeries,
      computations.reportDistributions,
      passThroughLimiter,
    );

    const done = service.getDashboard(memberId);
    for (let settled = 0; settled < homepageReports.length; settled++) {
      await flush();
      expect(computations.pending.length).toBeLessThanOrEqual(HOMEPAGE_REPORT_CONCURRENCY);
      computations.pending.shift()!();
    }

    const dashboard = await done;
    expect(computations.maxActive()).toBe(HOMEPAGE_REPORT_CONCURRENCY);
    expect(computations.computeSeries).toHaveBeenCalledTimes(3);
    expect(computations.computeDistribution).toHaveBeenCalledTimes(4);
    expect(dashboard.homepageReports.map((r) => [r.id, r.kind])).toEqual(
      homepageReports.map((r) => [r.id, r.type === 'distribution' ? 'distribution' : 'series']),
    );
  });

  it("runs in one of the member's dashboard slots", async () => {
    const run = vi.fn(
      (_key: string, _limit: unknown, _onBusy: () => Error, work: () => Promise<unknown>) => work(),
    );
    const computations = controlledComputations();
    const service = new DashboardService(
      fakeDb([]),
      ownershipWithOneBank().ownership,
      computations.reportSeries,
      computations.reportDistributions,
      { run } as unknown as InFlightLimiter,
    );

    await service.getDashboard(memberId);

    expect(run).toHaveBeenCalledWith(
      `dashboard:${memberId}`,
      DASHBOARD_IN_FLIGHT,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('refuses with dashboard_in_progress (429) when every slot is taken, computing nothing', async () => {
    const { ownership, listOwnedBanks } = ownershipWithOneBank();
    const busyLimiter = {
      run: (_key: string, _limit: unknown, onBusy: () => Error) => Promise.reject(onBusy()),
    } as unknown as InFlightLimiter;
    const computations = controlledComputations();
    const service = new DashboardService(
      fakeDb([]),
      ownership,
      computations.reportSeries,
      computations.reportDistributions,
      busyLimiter,
    );

    await expect(service.getDashboard(memberId)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: { code: 'dashboard_in_progress' },
    });
    expect(listOwnedBanks).not.toHaveBeenCalled();
  });
});
