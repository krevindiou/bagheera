import { AMOUNT_CEILING } from '@bagheera/money';
import { defineComponent, h } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import type { Account, Bank } from '../accounts/accounts.types';
import { entryFormValues } from './entryForm';
import OperationFields from './OperationFields.vue';
import { operationSchema, type OperationForm } from './operations.schemas';
import { PAYMENT_METHOD_ID, type Category, type PaymentMethod } from './operations.types';

const apiClient = asMockedApiClient(realApiClient);

const CATEGORY_FOOD = '00000000-0000-7000-8000-000000000101';
const CATEGORY_SALARY = '00000000-0000-7000-8000-000000000102';
const ACCOUNT_CHECKING = '00000000-0000-7000-8000-000000000201';
const ACCOUNT_SAVINGS = '00000000-0000-7000-8000-000000000202';

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

// OperationFields binds to its parent's vee-validate form by injection, so
// it needs a host that owns the `useForm`.
function mountFields(initial: Partial<OperationForm> = {}) {
  let form!: ReturnType<typeof useForm<OperationForm>>;
  const Host = defineComponent({
    setup(_, { slots }) {
      form = useForm<OperationForm>({
        validationSchema: toTypedSchema(operationSchema),
        initialValues: { ...entryFormValues(null), ...initial },
      });
      return () =>
        h(
          OperationFields,
          {
            idPrefix: 'x',
            accountId: ACCOUNT_CHECKING,
            categories,
            paymentMethods,
            accounts,
            banks,
            valueDateLabel: 'Value date',
            transferPlaceholder: 'Pick an account',
          },
          slots,
        );
    },
  });
  const wrapper = mount(Host, {
    ...withGlobalPlugins(),
    slots: {
      'after-value-date': '<p id="after-date">after date</p>',
      end: '<p id="the-end">end</p>',
    },
    attachTo: document.body,
  });
  return { wrapper, form: () => form };
}

const optionLabels = (select: { findAll: (s: string) => { text: () => string }[] }) =>
  select.findAll('option').map((o) => o.text());

describe('OperationFields', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue({ data: [], error: undefined, response: new Response() });
  });

  it('builds every input id from the prefix', () => {
    const { wrapper } = mountFields();

    for (const id of [
      'x-type-debit',
      'x-type-credit',
      'x-third-party',
      'x-amount',
      'x-category',
      'x-payment-method',
      'x-value-date',
      'x-notes',
      'x-reconciled',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true);
    }
    expect(wrapper.get('#x-value-date').element.closest('.mb-3')?.textContent).toContain(
      'Value date',
    );
    wrapper.unmount();
  });

  it('renders the after-value-date and end slots', () => {
    const { wrapper } = mountFields();

    expect(wrapper.find('#after-date').exists()).toBe(true);
    expect(wrapper.find('#the-end').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows the currency symbol of the source account on the amount', () => {
    const { wrapper } = mountFields();

    expect(wrapper.get('.input-group-text').text()).toBe('$');
    wrapper.unmount();
  });

  it('writes edits into the enclosing form', async () => {
    const { wrapper, form } = mountFields();

    await wrapper.get('#x-third-party').setValue('Landlord');
    await wrapper.get('#x-amount').setValue('12.5');
    await wrapper.get('#x-notes').setValue('rent');
    await wrapper.get('#x-reconciled').setValue(true);

    expect(form().values).toMatchObject({
      thirdParty: 'Landlord',
      amount: 12.5,
      notes: 'rent',
      reconciled: true,
    });
    wrapper.unmount();
  });

  it('offers only payment methods of the selected type', async () => {
    const { wrapper } = mountFields();
    const methods = () => optionLabels(wrapper.get('#x-payment-method'));

    expect(methods()).toContain('Check');
    expect(methods()).not.toContain('Deposit');

    await wrapper.get('#x-type-credit').setValue(true);

    expect(methods()).toContain('Deposit');
    expect(methods()).not.toContain('Check');
    wrapper.unmount();
  });

  it('clears a category that no longer matches after switching type', async () => {
    const { wrapper, form } = mountFields({ categoryId: CATEGORY_FOOD });

    await wrapper.get('#x-type-credit').setValue(true);
    await flushPromises();

    expect(form().values.categoryId).toBeUndefined();
    wrapper.unmount();
  });

  it('shows the transfer account only for a transfer payment method, with its placeholder', async () => {
    const { wrapper } = mountFields();
    expect(wrapper.find('#x-transfer-account').exists()).toBe(false);

    await wrapper.get('#x-payment-method').setValue(PAYMENT_METHOD_ID.TRANSFER_DEBIT);

    const transfer = wrapper.get('#x-transfer-account');
    expect(optionLabels(transfer)).toEqual(['Pick an account', 'Savings']);
    wrapper.unmount();
  });

  it('explains a blank form field by field once it is validated', async () => {
    const { wrapper, form } = mountFields();

    await form().validate();
    await flushPromises();

    const errors = wrapper.findAll('.invalid-feedback').map((e) => e.text());
    expect(errors).toEqual([
      'This field is required.',
      'Enter an amount greater than zero.',
      'This field is required.',
    ]);
    expect(wrapper.get('#x-third-party').classes()).toContain('is-invalid');
    expect(wrapper.get('#x-payment-method').classes()).toContain('is-invalid');
    wrapper.unmount();
  });

  it('gives a zero amount and an over-ceiling amount different messages', async () => {
    const { wrapper, form } = mountFields();
    const amountField = () => wrapper.get('#x-amount').element.closest('.mb-3')!.textContent;

    await wrapper.get('#x-amount').setValue('0');
    await form().validate();
    await flushPromises();
    expect(amountField()).toContain('Enter an amount greater than zero.');

    await wrapper.get('#x-amount').setValue(String(AMOUNT_CEILING + 1));
    await form().validate();
    await flushPromises();
    expect(amountField()).toContain('Enter a smaller amount.');
    expect(wrapper.get('#x-amount').classes()).toContain('is-invalid');
    wrapper.unmount();
  });
});
