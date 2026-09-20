import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { colorForCurrency } from '../../components/chartColors';
import RankedChart from '../../components/RankedChart.vue';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { useConfirm } from '../../composables/useConfirm';
import type { Account } from '../accounts/accounts.types';
import ReportsPage from './ReportsPage.vue';
import type { Report, ReportDistribution, ReportSeries } from './reports.types';

const apiClient = asMockedApiClient(realApiClient);

// "reports" carries meta.requiresAuth on the real route table — a dedicated
// guard-free stub avoids the real guard redirecting every push to sign-in
// (see the AccountsPage/OperationsPage specs for the same reasoning).
function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/reports', name: 'reports', component: { template: '<div />' } }],
  });
}

const accounts: Account[] = [
  { id: 'a1', bankId: 'b1', name: 'Checking', currency: 'USD', closed: false, deleted: false },
];

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    memberId: 'm1',
    type: 'sum',
    title: 'Rent',
    homepage: false,
    valueDateStart: null,
    valueDateEnd: null,
    thirdParties: null,
    accountIds: [],
    categoryIds: [],
    reconciledOnly: null,
    periodGrouping: 'month',
    dataGrouping: null,
    significantResultsNumber: null,
    ...overrides,
  };
}

const emptySeries: ReportSeries = { hidden: false, axisBounds: null, series: [] };
const emptyDistribution: ReportDistribution = { hidden: false, series: [] };

function mockGet(
  reports: Report[],
  series: ReportSeries = emptySeries,
  distribution: ReportDistribution = emptyDistribution,
) {
  apiClient.GET.mockImplementation(async (path: string) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
    if (path === '/reports') return ok(reports);
    if (path === '/accounts') return ok(accounts);
    if (path === '/reports/{id}/series') return ok(series);
    if (path === '/reports/{id}/distribution') return ok(distribution);
    return ok(undefined);
  });
}

let router: Router;
let wrapper: VueWrapper | undefined;

describe('ReportsPage', () => {
  beforeEach(async () => {
    router = createTestRouter();
    await router.push({ name: 'reports' });
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.DELETE.mockReset();
    mockGet([]);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('shows the empty state when there are no reports', async () => {
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.text()).toContain('No reports yet.');
  });

  it('lists reports with a type badge and a homepage badge when applicable', async () => {
    mockGet([
      report({ id: 'r1', type: 'sum', title: 'Rent' }),
      report({ id: 'r2', homepage: true }),
    ]);
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="report-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Sum');
    expect(rows[0].text()).toContain('Rent');
    expect(rows[0].text()).not.toContain('Shown on the homepage');
    expect(rows[1].find('.pill-violet').exists()).toBe(true);
  });

  it('toggles the chart when View chart is clicked, showing debit and credit as separate series', async () => {
    mockGet([report()], {
      hidden: false,
      axisBounds: null,
      series: [
        {
          currency: 'USD',
          debit: [{ period: '2026-01', value: 10 }],
          credit: [{ period: '2026-01', value: 5 }],
        },
      ],
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    // Scoped to the row: the header also carries a "New average report"
    // btn-outline-secondary button, which an unscoped selector would hit
    // first.
    const rowButton = () =>
      wrapper!.find('[data-testid="report-row"] button.btn-outline-secondary');
    await rowButton().trigger('click');
    await flushPromises();
    expect(rowButton().attributes('aria-label')).toBe('Hide chart');
    expect(wrapper.find('.synthesis-chart').exists()).toBe(true);
    const usdColor = colorForCurrency('USD');
    expect(wrapper.findComponent(SynthesisChart).props('series')).toEqual([
      {
        label: 'USD Debit',
        color: usdColor,
        dash: [8, 4],
        points: [{ period: '2026-01', value: 10 }],
      },
      { label: 'USD Credit', color: usdColor, points: [{ period: '2026-01', value: 5 }] },
    ]);

    await rowButton().trigger('click');
    expect(rowButton().attributes('aria-label')).toBe('View chart');
  });

  it('toggles the chart by clicking the row itself', async () => {
    mockGet([report()]);
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"]').trigger('click');
    const rowButton = wrapper.find('[data-testid="report-row"] button.btn-outline-secondary');
    expect(rowButton.attributes('aria-label')).toBe('Hide chart');
  });

  it('shows batch actions once a report is selected, and reloads after a batch delete', async () => {
    mockGet([report()]);
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-checkbox"]').setValue(true);
    expect(wrapper.find('[data-testid="report-batch-actions"]').exists()).toBe(true);

    const getCallsBefore = apiClient.GET.mock.calls.length;
    await wrapper.find('[data-testid="report-batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('hides batch actions again once the report is deselected', async () => {
    mockGet([report()]);
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="report-checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.find('[data-testid="report-batch-actions"]').exists()).toBe(true);

    await checkbox.setValue(false);
    expect(wrapper.find('[data-testid="report-batch-actions"]').exists()).toBe(false);
  });

  it('opens a new sum report form, and cancel returns to the buttons', async () => {
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('h2').text()).toBe('New report');
    expect(wrapper.find('#report-title').exists()).toBe(true);

    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.find('#report-title').exists()).toBe(false);
    expect(wrapper.find('button.btn-primary').exists()).toBe(true);
    expect(wrapper.find('button.btn-outline-secondary').exists()).toBe(true);
  });

  it("opens a new average report form, submitting with type 'average'", async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-outline-secondary').trigger('click');
    await wrapper.find('#report-title').setValue('Average spend');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({ body: expect.objectContaining({ type: 'average' }) }),
    );
  });

  it('deletes a single report once the confirmation is accepted', async () => {
    mockGet([report({ id: 'r1', title: 'Rent' })]);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"] button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/reports/{id}', {
      params: { path: { id: 'r1' } },
    });
    expect(wrapper.text()).toContain('Report deleted');
  });

  it("doesn't delete a report when the confirmation is cancelled", async () => {
    mockGet([report()]);
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"] button.btn-outline-danger').trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });

  it('shows an error toast when deleting a report fails', async () => {
    mockGet([report()]);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"] button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it("doesn't toggle the row's chart when its delete button is clicked", async () => {
    mockGet([report()]);
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"] button.btn-outline-danger').trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(wrapper.text()).not.toContain('Hide chart');
  });

  it("opens a new distribution report form, submitting with type 'distribution'", async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.findAll('button.btn-outline-secondary')[1].trigger('click');
    await wrapper.find('#report-title').setValue('Spending by category');
    expect(wrapper.find('#report-data-grouping').exists()).toBe(true);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({
        body: expect.objectContaining({
          type: 'distribution',
          dataGrouping: 'category',
          significantResultsNumber: 5,
        }),
      }),
    );
  });

  it('shows a distribution chart instead of the time-series chart for a distribution report', async () => {
    mockGet([report({ type: 'distribution', dataGrouping: 'category' })], emptySeries, {
      hidden: false,
      series: [
        {
          currency: 'USD',
          debit: [
            { label: 'Food', points: [{ period: '2026-01-01', value: 100 }] },
            { label: null, points: [{ period: '2026-01-01', value: 10 }] },
          ],
          credit: [],
        },
      ],
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="report-row"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.synthesis-chart').exists()).toBe(false);
    expect(wrapper.findComponent(RankedChart).props('facets')).toMatchObject([
      {
        kind: 'snapshot',
        bars: [
          { label: 'Food', value: -100 },
          { label: 'Other', value: -10 },
        ],
      },
    ]);
  });

  it('opens the edit form for a report and reloads once saved', async () => {
    mockGet([report({ title: 'Rent' })]);
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(ReportsPage, withGlobalPlugins(router));
    await flushPromises();

    // Second outline-secondary button in the row: [View chart, Edit].
    await wrapper
      .findAll('[data-testid="report-row"] button.btn-outline-secondary')[1]
      .trigger('click');
    expect((wrapper.find('#report-title').element as HTMLInputElement).value).toBe('Rent');

    await wrapper.find('#report-title').setValue('Rent updated');
    await submitAndSettle(wrapper);

    expect(wrapper.find('#report-title').exists()).toBe(false);
  });
});
