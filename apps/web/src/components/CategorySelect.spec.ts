import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { groupCategories, type Category } from '../domain/referenceData';
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
    props?: { emptyLabel?: string; modelValue?: string | string[]; multiple?: boolean };
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

  it('renders a checkbox list instead of a <select> once `multiple` is passed', () => {
    const wrapper = mountSelect({ props: { multiple: true, modelValue: ['c1'] } });

    expect(wrapper.find('select').exists()).toBe(false);
    expect(wrapper.find('[role="group"]').exists()).toBe(true);
    expect(
      wrapper
        .findAll('input[type="checkbox"]')
        .map((input) => (input.element as HTMLInputElement).value),
    ).toEqual(['c3', 'c1', 'c2']);
  });

  it('binds an array of ids both ways in multiple mode, checking several without Ctrl/Cmd', async () => {
    const wrapper = mountSelect({ props: { multiple: true, modelValue: ['c1'] } });
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    const c1 = checkboxes.find((i) => (i.element as HTMLInputElement).value === 'c1')!;
    const c3 = checkboxes.find((i) => (i.element as HTMLInputElement).value === 'c3')!;

    expect((c1.element as HTMLInputElement).checked).toBe(true);

    await c3.setValue(true);

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['c1', 'c3']]);
  });

  it('indents a child category under its group heading', () => {
    const wrapper = mountSelect({ props: { multiple: true } });

    expect(wrapper.find('.checkbox-list-group-label').text()).toBe('Food');
    const childLabel = wrapper
      .findAll('label')
      .find((label) => label.text() === 'Food > Groceries')!;
    expect(childLabel.element.closest('.form-check')!.className).toContain('form-check-child');
  });

  it('puts the id and listeners it is given on the <select>', async () => {
    const onBlur = vi.fn();
    const wrapper = mountSelect({ attrs: { id: 'category', onBlur } });
    const select = wrapper.find('select');

    expect(select.attributes('id')).toBe('category');
    await select.trigger('blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('derives the checkbox-list group id and aria-labelledby from the given id', () => {
    const wrapper = mountSelect({ props: { multiple: true }, attrs: { id: 'report-categories' } });
    const group = wrapper.find('[role="group"]');

    expect(group.attributes('id')).toBe('report-categories');
    expect(group.attributes('aria-labelledby')).toBe('report-categories-label');
    expect(wrapper.find('#report-categories-c3').exists()).toBe(true);
  });
});
