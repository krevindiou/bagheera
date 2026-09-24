import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { groupCategories, type Category } from '../pages/operations/operations.types';
import CategorySelect from './CategorySelect.vue';

// One standalone category (Rent) and a parent with a child (Food >
// Groceries) — groupCategories lists the standalone group first, so the
// DOM order of the options is Rent, Food, Groceries.
const categories: Category[] = [
  { id: 'c1', parentId: null, type: 'debit', name: 'Food' },
  { id: 'c2', parentId: 'c1', type: 'debit', name: 'Groceries' },
  { id: 'c3', parentId: null, type: 'debit', name: 'Rent' },
];
const groups = groupCategories(categories);

function mountSelect(
  options: {
    props?: { emptyLabel?: string; modelValue?: string | string[] };
    attrs?: Record<string, unknown>;
  } = {},
) {
  return mount(CategorySelect, {
    props: { groups, allCategories: categories, ...options.props },
    attrs: options.attrs,
  });
}

// Options sitting directly under the <select>, outside any optgroup.
function topLevelOptionTexts(wrapper: ReturnType<typeof mountSelect>): string[] {
  return wrapper.findAll('select > option').map((option) => option.text());
}

describe('CategorySelect', () => {
  it('lists a standalone category as a plain option and a parent with children as an optgroup', () => {
    const wrapper = mountSelect();

    expect(topLevelOptionTexts(wrapper)).toEqual(['Rent']);
    const group = wrapper.find('optgroup');
    expect(group.attributes('label')).toBe('Food');
    expect(group.findAll('option').map((option) => option.text())).toEqual([
      'Food',
      'Food > Groceries',
    ]);
  });

  it('leads with an empty-valued option only when given an empty label', () => {
    expect(topLevelOptionTexts(mountSelect())).toEqual(['Rent']);

    const wrapper = mountSelect({ props: { emptyLabel: 'No category' } });
    const first = wrapper.find('select > option');
    expect(first.text()).toBe('No category');
    expect(first.attributes('value')).toBe('');
  });

  it('binds a single category id both ways', async () => {
    const wrapper = mountSelect({ props: { modelValue: 'c2' } });
    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe('c2');

    await select.setValue('c3');

    expect(wrapper.emitted('update:modelValue')).toEqual([['c3']]);
  });

  it('binds an array of ids once `multiple` is passed through', async () => {
    const wrapper = mountSelect({ props: { modelValue: ['c1'] }, attrs: { multiple: '' } });
    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).multiple).toBe(true);

    await select.setValue(['c3', 'c2']);

    expect(wrapper.emitted('update:modelValue')).toEqual([[['c3', 'c2']]]);
  });

  it('puts the id and listeners it is given on the <select>', async () => {
    const onBlur = vi.fn();
    const wrapper = mountSelect({ attrs: { id: 'category', onBlur } });
    const select = wrapper.find('select');

    expect(select.attributes('id')).toBe('category');
    await select.trigger('blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
