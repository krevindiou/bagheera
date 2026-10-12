import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CheckboxList from './CheckboxList.vue';

const items = [
  { id: 'a1', label: 'Checking' },
  { id: 'a2', label: 'Savings' },
];

function mountList(
  options: {
    props?: { modelValue?: string[]; items?: typeof items };
    attrs?: Record<string, unknown>;
  } = {},
) {
  return mount(CheckboxList, {
    props: { items, ...options.props },
    attrs: options.attrs,
  });
}

describe('CheckboxList', () => {
  it('renders one labelled checkbox per item', () => {
    const wrapper = mountList({ attrs: { id: 'accounts' } });

    const labels = wrapper.findAll('label').map((label) => label.text());
    expect(labels).toEqual(['Checking', 'Savings']);
    expect(wrapper.find('#accounts-a1').exists()).toBe(true);
    expect(wrapper.find('#accounts-a2').exists()).toBe(true);
  });

  it('puts items under their group heading, each group named for assistive tech', () => {
    const wrapper = mount(CheckboxList, {
      props: {
        items: [
          { id: 'p1', label: 'Check', group: 'Debit' },
          { id: 'p2', label: 'Check', group: 'Credit' },
        ],
      },
      attrs: { id: 'methods' },
    });

    const groups = wrapper.findAll('[role="group"] [role="group"]');
    expect(groups.map((g) => g.attributes('aria-label'))).toEqual(['Debit', 'Credit']);
    expect(groups.map((g) => g.find('label').text())).toEqual(['Check', 'Check']);
  });

  it('checks the boxes matching the model value', () => {
    const wrapper = mountList({ props: { modelValue: ['a2'] }, attrs: { id: 'accounts' } });

    expect((wrapper.find('#accounts-a1').element as HTMLInputElement).checked).toBe(false);
    expect((wrapper.find('#accounts-a2').element as HTMLInputElement).checked).toBe(true);
  });

  it('adds to the selection without needing Ctrl/Cmd when a second box is checked', async () => {
    const wrapper = mountList({ props: { modelValue: ['a1'] }, attrs: { id: 'accounts' } });

    await wrapper.find('#accounts-a2').setValue(true);

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['a1', 'a2']]);
  });

  it('drops an item from the selection once its box is unchecked', async () => {
    const wrapper = mountList({ props: { modelValue: ['a1', 'a2'] }, attrs: { id: 'accounts' } });

    await wrapper.find('#accounts-a1').setValue(false);

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['a2']]);
  });

  it('is a labelled group deriving aria-labelledby from its id', () => {
    const wrapper = mountList({ attrs: { id: 'accounts' } });
    const group = wrapper.find('[role="group"]');

    expect(group.attributes('id')).toBe('accounts');
    expect(group.attributes('aria-labelledby')).toBe('accounts-label');
  });

  it('puts the id and listeners it is given on the group, not stray checkboxes', async () => {
    const onBlur = vi.fn();
    const wrapper = mountList({ attrs: { id: 'accounts', onBlur } });

    await wrapper.find('[role="group"]').trigger('blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
