import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import SearchPanel from './search.vue';
import type { Category, PaymentMethod, SearchCriteria } from '../../domain/referenceData';

const categories: Category[] = [
  { id: 'c1', parentId: null, type: 'debit', name: 'Food' },
  { id: 'c2', parentId: null, type: 'credit', name: 'Salary' },
];
const paymentMethods: PaymentMethod[] = [
  { id: 'p1', name: 'Cash', type: 'debit' },
  { id: 'p2', name: 'Deposit', type: 'credit' },
];

function mountPanel(initialCriteria?: SearchCriteria) {
  return mount(SearchPanel, {
    ...withGlobalPlugins(),
    props: { categories, paymentMethods, initialCriteria },
  });
}

describe('SearchPanel', () => {
  it('defaults to "Any" type (no filter) with every other field empty', () => {
    const wrapper = mountPanel();
    expect((wrapper.find('#search-type-any').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#search-reconciled').element as HTMLSelectElement).value).toBe('');
  });

  it('matches both types by default — no type is sent when "Any" is picked', async () => {
    const wrapper = mountPanel();
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.type).toBeUndefined();
  });

  it('hydrates "Any" when the remembered criteria have no type', () => {
    const wrapper = mountPanel({ thirdParty: 'Foo' });
    expect((wrapper.find('#search-type-any').element as HTMLInputElement).checked).toBe(true);
  });

  it('offers categories/payment methods of both types when "Any" is picked', () => {
    const wrapper = mountPanel();
    const options = wrapper
      .findAll('#search-payment-methods input[type="checkbox"]')
      .map((o) => (o.element as HTMLInputElement).value);
    expect(options).toEqual(['p1', 'p2']);
  });

  it('groups payment methods under their type when "Any" is picked', async () => {
    const wrapper = mountPanel();
    const headings = () =>
      wrapper.findAll('#search-payment-methods .checkbox-list-group-label').map((h) => h.text());
    expect(headings()).toEqual(['Debit', 'Credit']);
    expect(
      wrapper
        .findAll('#search-payment-methods [role="group"]')
        .map((g) => g.attributes('aria-label')),
    ).toEqual(['Debit', 'Credit']);

    await wrapper.find('#search-type-debit').setValue(true);
    expect(headings()).toEqual([]);
  });

  it('keeps a selection made under "Any" when switching to its matching type', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-categories-c1').setValue(true);
    await wrapper.find('#search-type-debit').setValue(true);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.categoryIds).toEqual(['c1']);
  });

  it('drops a selection that no longer matches once switched away from "Any"', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-categories-c2').setValue(true);
    await wrapper.find('#search-type-debit').setValue(true);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.categoryIds).toBeUndefined();
  });

  it('hydrates every field from the initial criteria', () => {
    const wrapper = mountPanel({
      type: 'credit',
      thirdParty: 'Foo',
      categoryIds: ['c2'],
      paymentMethodIds: ['p2'],
      amountComparators: [{ operator: 'lt', value: 50 }],
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      notes: 'bar',
      reconciled: false,
    });
    expect((wrapper.find('#search-type-credit').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#search-third-party').element as HTMLInputElement).value).toBe('Foo');
    expect((wrapper.find('#search-amount-operator-1').element as HTMLSelectElement).value).toBe(
      'lt',
    );
    expect((wrapper.find('#search-date-from').element as HTMLInputElement).value).toBe(
      '2026-01-01',
    );
    expect((wrapper.find('#search-notes').element as HTMLInputElement).value).toBe('bar');
    expect((wrapper.find('#search-reconciled').element as HTMLSelectElement).value).toBe('false');
  });

  it('builds and emits criteria on submit, trimming text and dropping empty fields', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-third-party').setValue('  Landlord  ');
    await wrapper.find('#search-categories-c1').setValue(true);
    await wrapper.find('#search-payment-methods-p1').setValue(true);
    await wrapper.find('#search-amount-operator-1').setValue('gt');
    await wrapper.findAll('input[type="number"]')[0].setValue(100);
    await wrapper.find('#search-date-from').setValue('2026-01-01');
    await wrapper.find('#search-date-to').setValue('2026-01-31');
    await wrapper.find('#search-notes').setValue('  rent  ');
    await wrapper.find('#search-reconciled').setValue('true');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          thirdParty: 'Landlord',
          categoryIds: ['c1'],
          paymentMethodIds: ['p1'],
          amountComparators: [{ operator: 'gt', value: 100 }],
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          notes: 'rent',
          reconciled: true,
        },
      ],
    ]);
  });

  it("groups categories with children under their parent's name", () => {
    const wrapper = mount(SearchPanel, {
      ...withGlobalPlugins(),
      props: {
        categories: [...categories, { id: 'c3', parentId: 'c1', type: 'debit', name: 'Groceries' }],
        paymentMethods,
      },
    });
    expect(wrapper.find('.checkbox-list-group-label').text()).toBe('Food');
    expect(wrapper.find('#search-categories-c3').exists()).toBe(true);
  });

  it('ignores the second amount row when the first is empty', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-amount-operator-2').setValue('lt');
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toBeUndefined();
  });

  it('drops the amount comparator when a typed value is cleared back out', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-amount-operator-1').setValue('gt');
    const amountInput = wrapper.findAll('input[type="number"]')[0];
    await amountInput.setValue(100);
    await amountInput.setValue('');
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toBeUndefined();
  });

  it('defaults the operator to "=" when a value is typed while it is still "Any"', async () => {
    const wrapper = mountPanel();
    await wrapper.findAll('input[type="number"]')[0].setValue(1000);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toEqual([{ operator: 'eq', value: 1000 }]);
  });

  it('does not override an operator the member already chose', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-amount-operator-1').setValue('lt');
    await wrapper.findAll('input[type="number"]')[0].setValue(1000);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toEqual([{ operator: 'lt', value: 1000 }]);
  });

  it('still ignores the second row when only its value is typed and the first stays empty', async () => {
    const wrapper = mountPanel();
    await wrapper.findAll('input[type="number"]')[1].setValue(20);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toBeUndefined();
  });

  it('includes the second amount row once the first is set too', async () => {
    const wrapper = mountPanel();
    await wrapper.find('#search-amount-operator-1').setValue('gte');
    await wrapper.findAll('input[type="number"]')[0].setValue(10);
    await wrapper.find('#search-amount-operator-2').setValue('lte');
    await wrapper.findAll('input[type="number"]')[1].setValue(20);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.amountComparators).toEqual([
      { operator: 'gte', value: 10 },
      { operator: 'lte', value: 20 },
    ]);
  });

  it('drops a category/payment-method selection that no longer matches the type', async () => {
    const wrapper = mountPanel({ type: 'debit', categoryIds: ['c1'], paymentMethodIds: ['p1'] });
    await wrapper.find('#search-type-credit').setValue(true);
    await wrapper.find('form').trigger('submit');

    const [criteria] = wrapper.emitted('submit')![0] as [SearchCriteria];
    expect(criteria.categoryIds).toBeUndefined();
    expect(criteria.paymentMethodIds).toBeUndefined();

    // And switching back to debit restores the debit-only choices.
    await wrapper.find('#search-type-debit').setValue(true);
    await wrapper.find('#search-categories-c1').setValue(true);
    await wrapper.find('form').trigger('submit');

    const [secondCriteria] = wrapper.emitted('submit')![1] as [SearchCriteria];
    expect(secondCriteria.type).toBe('debit');
    expect(secondCriteria.categoryIds).toEqual(['c1']);
  });

  it('resets every field and emits clear when Clear is clicked', async () => {
    const wrapper = mountPanel({ type: 'credit', thirdParty: 'Foo', notes: 'bar' });
    await wrapper.find('button.btn-outline-secondary').trigger('click');

    expect((wrapper.find('#search-type-any').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#search-third-party').element as HTMLInputElement).value).toBe('');
    expect(wrapper.emitted('clear')).toHaveLength(1);
  });

  it('gives the four amount controls distinct accessible names', () => {
    const wrapper = mountPanel();
    // First input has aria-label "Amount value"
    const firstInput = wrapper.findAll('input[type="number"]')[0].element as HTMLInputElement;
    expect(firstInput.getAttribute('aria-label')).toBe('Amount value');
    // Second select has aria-label "Second amount condition"
    const secondSelect = wrapper.find('#search-amount-operator-2').element as HTMLSelectElement;
    expect(secondSelect.getAttribute('aria-label')).toBe('Second amount condition');
    // Second input has aria-label "Second amount value"
    const secondInput = wrapper.findAll('input[type="number"]')[1].element as HTMLInputElement;
    expect(secondInput.getAttribute('aria-label')).toBe('Second amount value');
  });
});
