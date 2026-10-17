import { AMOUNT_CEILING } from '@bagheera/money';
import { FIELD_LIMITS } from '@bagheera/reference-data';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from '../accounts/accounts.types';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import type { Category, PaymentMethod } from '../../domain/referenceData';
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
  nextOccurrence: '2026-02-15',
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
    apiClient.DELETE.mockReset();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, []));
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
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
    expect(useToast().toasts[0]?.text).toBe('Scheduled operation saved');
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it.each([
    [1, 'Scheduled operation saved, 1 operation added'],
    [4, 'Scheduled operation saved, 4 operations added'],
  ])('says how many operations a save adds (%i)', async (occurrencesDue, text) => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, { occurrencesDue }));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe(text);
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

  it("doesn't offer Delete when creating", () => {
    const wrapper = mountForm();
    expect(wrapper.find('button.btn-outline-danger').exists()).toBe(false);
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

  it('says how many operations an edit adds', async () => {
    apiClient.PATCH.mockResolvedValueOnce(jsonResult(200, { occurrencesDue: 3 }));
    const wrapper = mountForm({ scheduler });
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Scheduled operation saved, 3 operations added');
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

  it('saves a transfer scheduler with no target account as External', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
    const transfer = wrapper.get('#scheduler-transfer-account');
    expect(transfer.findAll('option')[0].text()).toBe('External account');

    await wrapper.find('#scheduler-third-party').setValue('Broker');
    await wrapper.find('#scheduler-amount').setValue('20');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/schedulers',
      expect.objectContaining({
        body: expect.objectContaining({
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
          transferAccountId: undefined,
        }),
      }),
    );
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  // A deleted target account leaves its schedulers on a transfer method with
  // no target; they must stay editable.
  it('updates a stored transfer scheduler that has no target account', async () => {
    apiClient.PATCH.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm({
      scheduler: {
        ...scheduler,
        paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        transferAccountId: null,
      },
    });
    // Selected, not just empty-valued: a select matching no option reads '' too.
    expect(
      (wrapper.get('#scheduler-transfer-account').element as HTMLSelectElement).selectedIndex,
    ).toBe(0);

    await wrapper.find('#scheduler-amount').setValue('75');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/schedulers/{id}', {
      params: { path: { id: 's1' } },
      body: expect.objectContaining({ amount: 75, transferAccountId: undefined }),
    });
    expect(wrapper.emitted('saved')).toHaveLength(1);
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

  it('shows a past-occurrences hint when creating with a first occurrence in the past', async () => {
    const wrapper = mountForm();
    expect(wrapper.text()).not.toContain(
      'Past occurrences will be added to the account when you save.',
    );

    await wrapper.find('#scheduler-value-date').setValue('2020-01-01');
    expect(wrapper.text()).toContain(
      'Past occurrences will be added to the account when you save.',
    );
  });

  it('hides the past-occurrences hint once the first occurrence is no longer in the past', async () => {
    const wrapper = mountForm();
    await wrapper.find('#scheduler-value-date').setValue('2020-01-01');
    expect(wrapper.text()).toContain(
      'Past occurrences will be added to the account when you save.',
    );

    await wrapper.find('#scheduler-value-date').setValue('2099-01-01');
    expect(wrapper.text()).not.toContain(
      'Past occurrences will be added to the account when you save.',
    );
  });

  it('never shows the past-occurrences hint when editing, even with a past first occurrence', () => {
    const wrapper = mountForm({ scheduler });
    expect(wrapper.text()).not.toContain(
      'Past occurrences will be added to the account when you save.',
    );
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

  it('refuses a limit date outside the range the API accepts, and explains why', async () => {
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-limit-date').setValue('2101-01-01');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
    const limitDate = wrapper.get('#scheduler-limit-date');
    expect(limitDate.element.closest('.mb-3')!.textContent).toContain(
      'Enter a date between 1/1/1900 and 12/31/2100.',
    );
    expect(limitDate.classes()).toContain('is-invalid');
  });

  it('refuses a limit date before the first occurrence, with a dedicated message', async () => {
    const wrapper = mountForm();
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find('#scheduler-value-date').setValue('2026-07-05');
    await wrapper.find('#scheduler-limit-date').setValue('2026-06-01');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
    const limitDate = wrapper.get('#scheduler-limit-date');
    expect(limitDate.element.closest('.mb-3')!.textContent).toContain(
      'Stop date must be on or after the first occurrence.',
    );
    expect(limitDate.element.closest('.mb-3')!.textContent).not.toContain('Enter a date between');
    expect(limitDate.classes()).toContain('is-invalid');
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

  it.each(['0', String(FIELD_LIMITS.FREQUENCY_VALUE + 1)])(
    "shows a validation error and doesn't submit for a frequency of %s",
    async (frequencyValue) => {
      const wrapper = mountForm();
      await wrapper.find('#scheduler-third-party').setValue('Landlord');
      await wrapper.find('#scheduler-amount').setValue('50');
      await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
      await wrapper.find('#scheduler-frequency-value').setValue(frequencyValue);
      await submitAndSettle(wrapper);

      expect(wrapper.text()).toContain(
        `Enter a whole number between 1 and ${FIELD_LIMITS.FREQUENCY_VALUE}.`,
      );
      expect(apiClient.POST).not.toHaveBeenCalled();
    },
  );

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

  describe('delete', () => {
    it('deletes the scheduler once confirmed and emits deleted', async () => {
      apiClient.DELETE.mockResolvedValueOnce(jsonResult(200));
      const wrapper = mountForm({ scheduler });

      await wrapper.find('button.btn-outline-danger').trigger('click');
      expect(useConfirm().state.options).toEqual({
        body: 'Delete 1 scheduled operation? The operations it already created are kept.',
        confirmLabel: 'Delete',
        danger: true,
      });
      useConfirm().settle(true);
      await flushPromises();

      expect(apiClient.DELETE).toHaveBeenCalledWith('/schedulers/{id}', {
        params: { path: { id: 's1' } },
      });
      expect(useToast().toasts[0]?.text).toBe('Scheduled operation deleted');
      expect(wrapper.emitted('deleted')).toHaveLength(1);
    });

    it('does nothing when the confirmation is cancelled', async () => {
      const wrapper = mountForm({ scheduler });
      await wrapper.find('button.btn-outline-danger').trigger('click');
      useConfirm().settle(false);
      await flushPromises();

      expect(apiClient.DELETE).not.toHaveBeenCalled();
      expect(wrapper.emitted('deleted')).toBeUndefined();
    });

    it("shows an error toast and doesn't emit deleted when the request fails", async () => {
      apiClient.DELETE.mockResolvedValueOnce(jsonResult(500));
      const wrapper = mountForm({ scheduler });
      await wrapper.find('button.btn-outline-danger').trigger('click');
      useConfirm().settle(true);
      await flushPromises();

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('deleted')).toBeUndefined();
    });
  });
});
