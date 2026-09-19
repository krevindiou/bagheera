import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import type { Account } from '../accounts/accounts.types';
import type { Category } from '../operations/operations.types';
import ReportForm from './ReportForm.vue';
import type { Report } from './reports.types';

const apiClient = asMockedApiClient(realApiClient);

const accounts: Account[] = [
  { id: 'a1', bankId: 'b1', name: 'Checking', currency: 'USD', closed: false, deleted: false },
  { id: 'a2', bankId: 'b1', name: 'Savings', currency: 'USD', closed: false, deleted: false },
];

const categories: Category[] = [
  { id: 'c1', parentId: null, type: 'credit', name: 'Salary' },
  { id: 'c2', parentId: null, type: 'debit', name: 'Groceries' },
];

const report: Report = {
  id: 'r1',
  memberId: 'm1',
  type: 'average',
  title: 'Monthly spend',
  homepage: true,
  valueDateStart: '2026-01-01',
  valueDateEnd: '2026-01-31',
  thirdParties: null,
  accountIds: ['a2'],
  categoryIds: ['c1'],
  reconciledOnly: true,
  periodGrouping: 'quarter',
  dataGrouping: null,
  significantResultsNumber: null,
};

function jsonResult(status: number, error?: unknown) {
  return { data: undefined, error, response: new Response(null, { status }) };
}

describe('ReportForm', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    apiClient.PATCH.mockReset();
    useToast().toasts.splice(0);
  });

  it('shows the create title and defaults period grouping to year', () => {
    // No field lets the member change the type after opening — it's fixed
    // by whichever "New ... report" button was clicked (see defaultType,
    // verified via the submitted body in the next test).
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, defaultType: 'average' },
    });
    expect(wrapper.find('h2').text()).toBe('New report');
    expect((wrapper.find('#report-period-grouping').element as HTMLSelectElement).value).toBe(
      'year',
    );
  });

  it('creates a report and emits saved', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, defaultType: 'sum' },
    });
    await wrapper.find('#report-title').setValue('Rent');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/reports', {
      body: {
        type: 'sum',
        title: 'Rent',
        homepage: false,
        valueDateStart: undefined,
        valueDateEnd: undefined,
        thirdParties: undefined,
        accountIds: [],
        categoryIds: [],
        reconciledOnly: undefined,
        periodGrouping: 'year',
      },
    });
    expect(useToast().toasts[0]?.text).toBe('Report saved');
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('sends reconciledOnly as undefined rather than false when left unchecked', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await wrapper.find('#report-title').setValue('Rent');
    await submitAndSettle(wrapper);

    const [, options] = apiClient.POST.mock.calls[0];
    expect((options as { body: { reconciledOnly?: boolean } }).body.reconciledOnly).toBeUndefined();
  });

  it('prefills every field from the report being edited', () => {
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, report },
    });
    expect(wrapper.find('h2').text()).toBe('Edit report');
    expect((wrapper.find('#report-title').element as HTMLInputElement).value).toBe('Monthly spend');
    expect((wrapper.find('#report-homepage').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#report-value-date-start').element as HTMLInputElement).value).toBe(
      '2026-01-01',
    );
    expect((wrapper.find('#report-reconciled').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#report-period-grouping').element as HTMLSelectElement).value).toBe(
      'quarter',
    );
  });

  it('updates a report via PATCH', async () => {
    apiClient.PATCH.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, report },
    });
    await wrapper.find('#report-title').setValue('Quarterly spend');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/reports/{id}', {
      params: { path: { id: 'r1' } },
      body: expect.objectContaining({ title: 'Quarterly spend' }),
    });
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it("shows a validation error and doesn't submit for an empty title", async () => {
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('This field is required.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows a validation error and doesn't submit for a backwards date range", async () => {
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await wrapper.find('#report-title').setValue('Rent');
    await wrapper.find('#report-value-date-start').setValue('2026-02-01');
    await wrapper.find('#report-value-date-end').setValue('2026-01-01');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('End date must be on or after the start date.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows an error toast and doesn't emit saved when submission fails", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400, { message: 'Bad request' }));
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await wrapper.find('#report-title').setValue('Rent');
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Bad request');
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('submits every optional field once filled in', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, defaultType: 'sum' },
    });
    await wrapper.find('#report-title').setValue('Rent');
    await wrapper.find('#report-homepage').setValue(true);
    await wrapper.find('#report-value-date-start').setValue('2026-02-01');
    await wrapper.find('#report-value-date-end').setValue('2026-02-28');
    await wrapper.find('#report-third-parties').setValue('Amazon');
    await wrapper.find('#report-accounts').setValue(['a1', 'a2']);
    await wrapper.find('#report-categories').setValue(['c1', 'c2']);
    await wrapper.find('#report-reconciled').setValue(true);
    await wrapper.find('#report-period-grouping').setValue('year');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/reports', {
      body: {
        type: 'sum',
        title: 'Rent',
        homepage: true,
        valueDateStart: '2026-02-01',
        valueDateEnd: '2026-02-28',
        thirdParties: 'Amazon',
        accountIds: ['a1', 'a2'],
        categoryIds: ['c1', 'c2'],
        reconciledOnly: true,
        periodGrouping: 'year',
      },
    });
  });

  it('falls back to a generic error toast when submission fails without a message', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await wrapper.find('#report-title').setValue('Rent');
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('shows dataGrouping/significantResultsNumber alongside periodGrouping for a distribution report, defaulting period grouping to year', () => {
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, defaultType: 'distribution' },
    });
    expect((wrapper.find('#report-period-grouping').element as HTMLSelectElement).value).toBe(
      'year',
    );
    expect((wrapper.find('#report-data-grouping').element as HTMLSelectElement).value).toBe(
      'category',
    );
    expect(
      (wrapper.find('#report-significant-results-number').element as HTMLInputElement).value,
    ).toBe('5');
  });

  it('creates a distribution report with its own fields plus periodGrouping', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, defaultType: 'distribution' },
    });
    await wrapper.find('#report-title').setValue('Spending by third party');
    await wrapper.find('#report-data-grouping').setValue('third_party');
    await wrapper.find('#report-significant-results-number').setValue('10');
    await wrapper.find('#report-period-grouping').setValue('month');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({
        body: expect.objectContaining({
          type: 'distribution',
          dataGrouping: 'third_party',
          significantResultsNumber: 10,
          periodGrouping: 'month',
        }),
      }),
    );
  });

  it('prefills dataGrouping/significantResultsNumber/periodGrouping when editing a distribution report', () => {
    const distributionReport: Report = {
      ...report,
      type: 'distribution',
      periodGrouping: 'quarter',
      dataGrouping: 'payment_method',
      significantResultsNumber: 8,
    };
    const wrapper = mount(ReportForm, {
      ...withGlobalPlugins(),
      props: { accounts, categories, report: distributionReport },
    });
    expect((wrapper.find('#report-data-grouping').element as HTMLSelectElement).value).toBe(
      'payment_method',
    );
    expect(
      (wrapper.find('#report-significant-results-number').element as HTMLInputElement).value,
    ).toBe('8');
    expect((wrapper.find('#report-period-grouping').element as HTMLSelectElement).value).toBe(
      'quarter',
    );
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(ReportForm, { ...withGlobalPlugins(), props: { accounts, categories } });
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
