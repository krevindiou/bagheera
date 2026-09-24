import { AMOUNT_CEILING } from '@bagheera/money';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from '../accounts/accounts.types';
import { PAYMENT_METHOD_ID } from '../operations/operations.types';
import type { Category, PaymentMethod } from '../operations/operations.types';
import SchedulerForm from './SchedulerForm.vue';
import type { Scheduler } from './schedulers.types';

const apiClient = asMockedApiClient(realApiClient);

// schedulerSchema validates category/payment-method/account ids as real
// uuids, so fixtures need uuid-shaped ids, not plain "c1"/"a1" labels.
const CATEGORY_FOOD = '00000000-0000-7000-8000-000000000301';
const CATEGORY_SALARY = '00000000-0000-7000-8000-000000000302';
const ACCOUNT_CHECKING = '00000000-0000-7000-8000-000000000401';
const ACCOUNT_SAVINGS = '00000000-0000-7000-8000-000000000402';

const categories: Category[] = [
  { id: CATEGORY_FOOD, parentId: null, type: 'debit', name: 'Food' },
  { id: CATEGORY_SALARY, parentId: null, type: 'credit', name: 'Salary' },
];
const paymentMethods: PaymentMethod[] = [
  { id: PAYMENT_METHOD_ID.CHECK_DEBIT, name: 'Check', type: 'debit' },
  { id: PAYMENT_METHOD_ID.DEPOSIT, name: 'Deposit', type: 'credit' },
  { id: PAYMENT_METHOD_ID.TRANSFER_DEBIT, name: 'Transfer debit', type: 'debit' },
];
const accounts: Account[] = [
  {
    id: ACCOUNT_CHECKING,
    bankId: 'b1',
    name: 'Checking',
    currency: 'USD',
    closed: false,
    deleted: false,
  },
  {
    id: ACCOUNT_SAVINGS,
    bankId: 'b1',
    name: 'Savings',
    currency: 'USD',
    closed: false,
    deleted: false,
  },
];
const banks: Bank[] = [{ id: 'b1', name: 'Chase', closed: false, deleted: false }];

const scheduler: Scheduler = {
  id: 's1',
  accountId: ACCOUNT_CHECKING,
  transferAccountId: null,
  categoryId: CATEGORY_FOOD,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  thirdParty: 'Landlord',
  debit: 500000,
  credit: null,
  valueDate: '2026-01-15',
  reconciled: false,
  notes: '',
  limitDate: null,
  frequencyUnit: 'month',
  frequencyValue: 1,
  active: true,
};

function mountForm(overrides: { scheduler?: Scheduler | null; attachTo?: Element } = {}) {
  const { attachTo, scheduler: schedulerOverride } = overrides;
  return mount(SchedulerForm, {
    ...withGlobalPlugins(),
    ...(attachTo ? { attachTo } : {}),
    props: {
      accountId: ACCOUNT_CHECKING,
      categories,
      paymentMethods,
      accounts,
      banks,
      scheduler: schedulerOverride,
    },
  });
}

function jsonResult(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

describe('SchedulerForm', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    apiClient.PATCH.mockReset();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, []));
    useToast().toasts.splice(0);
  });

  it('creates a scheduler and emits saved', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-frequency-value').setValue('2');
    await wrapper.find('#scheduler-frequency-unit').setValue('week');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/schedulers', {
      body: {
        accountId: ACCOUNT_CHECKING,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 50,
        categoryId: undefined,
        paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
        transferAccountId: undefined,
        valueDate: expect.any(String),
        notes: '',
        reconciled: false,
        limitDate: undefined,
        frequencyUnit: 'week',
        frequencyValue: 2,
        active: true,
      },
    });
    expect(useToast().toasts[0]?.text).toBe('Scheduler saved');
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('shows a distinct message for a zero amount vs. one over the ceiling', async () => {
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);

    await wrapper.find('#scheduler-amount').setValue('0');
    await submitAndSettle(wrapper);
    expect(wrapper.text()).toContain('Enter an amount greater than zero.');
    expect(wrapper.text()).not.toContain('Enter a smaller amount.');

    await wrapper.find('#scheduler-amount').setValue(String(AMOUNT_CEILING + 1));
    await submitAndSettle(wrapper);
    expect(wrapper.text()).toContain('Enter a smaller amount.');
    expect(wrapper.text()).not.toContain('Enter an amount greater than zero.');

    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('prefills from the scheduler being edited, converting the stored amount', () => {
    const wrapper = mountForm({ scheduler });
    expect(wrapper.find('h2').text()).toBe('Edit scheduled operation');
    expect((wrapper.find('#scheduler-third-party').element as HTMLInputElement).value).toBe(
      'Landlord',
    );
    expect((wrapper.find('#scheduler-amount').element as HTMLInputElement).value).toBe('50');
    expect((wrapper.find('#scheduler-frequency-value').element as HTMLInputElement).value).toBe(
      '1',
    );
    expect((wrapper.find('#scheduler-active').element as HTMLInputElement).checked).toBe(true);
  });

  it('prefills an uncategorized credit scheduler as credit, with its credit amount', () => {
    const wrapper = mountForm({
      scheduler: {
        ...scheduler,
        paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
        debit: null,
        credit: 1_250_000,
        categoryId: null,
      },
    });
    expect((wrapper.find('#scheduler-type-credit').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#scheduler-amount').element as HTMLInputElement).value).toBe('125');
    expect((wrapper.find('#scheduler-category').element as HTMLSelectElement).value).toBe('');
  });

  it('updates a scheduler via PATCH and emits saved', async () => {
    apiClient.PATCH.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm({ scheduler });
    await wrapper.find('#scheduler-amount').setValue('75');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/schedulers/{id}', {
      params: { path: { id: 's1' } },
      body: expect.objectContaining({ amount: 75 }),
    });
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('shows the transfer-account field only for a transfer payment method, and includes it in the body', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    expect(wrapper.find('#scheduler-transfer-account').exists()).toBe(false);

    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
    expect(wrapper.find('#scheduler-transfer-account').exists()).toBe(true);

    await wrapper.find('#scheduler-third-party').setValue('Savings transfer');
    await wrapper.find('#scheduler-amount').setValue('20');
    await wrapper.find('#scheduler-transfer-account').setValue(ACCOUNT_SAVINGS);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/schedulers',
      expect.objectContaining({
        body: expect.objectContaining({ transferAccountId: ACCOUNT_SAVINGS }),
      }),
    );
  });

  it('filters category/payment-method choices to the selected type', async () => {
    const wrapper = mountForm();
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).not.toContain('Salary');

    await wrapper.find('#scheduler-type-credit').setValue(true);
    expect(wrapper.text()).toContain('Salary');
    expect(wrapper.text()).not.toContain('Food');

    await wrapper.find('#scheduler-type-debit').setValue(true);
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).not.toContain('Salary');
  });

  it("groups categories with children under their parent's name", () => {
    const CATEGORY_GROCERIES = '00000000-0000-7000-8000-000000000303';
    const wrapper = mount(SchedulerForm, {
      ...withGlobalPlugins(),
      props: {
        accountId: ACCOUNT_CHECKING,
        categories: [
          ...categories,
          { id: CATEGORY_GROCERIES, parentId: CATEGORY_FOOD, type: 'debit', name: 'Groceries' },
        ],
        paymentMethods,
        accounts,
        banks,
      },
    });

    const group = wrapper.find('optgroup');
    expect(group.attributes('label')).toBe('Food');
    expect(group.text()).toContain('Groceries');
  });

  it('submits the category, value date, limit date, notes, and reconciled fields once filled in', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-category').setValue(CATEGORY_FOOD);
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-value-date').setValue('2026-02-01');
    await wrapper.find('#scheduler-limit-date').setValue('2027-01-01');
    await wrapper.find('#scheduler-notes').setValue('Rent payment');
    await wrapper.find('#scheduler-reconciled').setValue(true);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/schedulers',
      expect.objectContaining({
        body: expect.objectContaining({
          categoryId: CATEGORY_FOOD,
          valueDate: '2026-02-01',
          limitDate: '2027-01-01',
          notes: 'Rent payment',
          reconciled: true,
        }),
      }),
    );
  });

  it('submits active: false once unchecked', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-active').setValue(false);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/schedulers',
      expect.objectContaining({ body: expect.objectContaining({ active: false }) }),
    );
  });

  it('falls back to a generic error toast when submission fails without a message', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it("shows a validation error and doesn't submit for a zero frequency", async () => {
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-frequency-value').setValue('0');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a frequency of at least 1.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows an error toast and doesn't emit saved when submission fails", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400, undefined, { message: 'Bad request' }));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Bad request');
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountForm();
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('focuses the amount field once a third-party autocomplete suggestion is picked', async () => {
    vi.useFakeTimers();
    apiClient.GET.mockResolvedValue(
      jsonResult(200, [{ thirdParty: 'Landlord', categoryId: CATEGORY_FOOD }]),
    );
    const wrapper = mountForm({ attachTo: document.body });
    const thirdParty = wrapper.find('#scheduler-third-party');
    await thirdParty.setValue('Landlord');
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();

    await thirdParty.trigger('change');
    await flushPromises();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.find('#scheduler-amount').element);
    wrapper.unmount();
  });
});
