import type { EntryType } from '@bagheera/reference-data';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import EntryTypeRadio from './EntryTypeRadio.vue';

function mountRadio(props: { modelValue?: EntryType; legend?: string; anyLabel?: string } = {}) {
  return mount(EntryTypeRadio, {
    ...withGlobalPlugins(),
    props: { idPrefix: 'x-type', modelValue: 'debit', ...props },
    attachTo: document.body,
  });
}

describe('EntryTypeRadio', () => {
  it('renders debit and credit radios with prefixed ids and their labels', () => {
    const wrapper = mountRadio();

    expect(wrapper.get('#x-type-debit').attributes('value')).toBe('debit');
    expect(wrapper.get('#x-type-credit').attributes('value')).toBe('credit');
    expect(wrapper.get('label[for="x-type-debit"]').text()).toBe('Debit');
    expect(wrapper.get('label[for="x-type-credit"]').text()).toBe('Credit');
    wrapper.unmount();
  });

  it('checks the radio matching the model', () => {
    const wrapper = mountRadio({ modelValue: 'credit' });

    expect((wrapper.get('#x-type-credit').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get('#x-type-debit').element as HTMLInputElement).checked).toBe(false);
    wrapper.unmount();
  });

  it('emits update:modelValue when the other type is chosen', async () => {
    const wrapper = mountRadio();

    await wrapper.get('#x-type-credit').setValue(true);

    expect(wrapper.emitted('update:modelValue')).toEqual([['credit']]);
    wrapper.unmount();
  });

  it('focuses the checked radio when it appears', () => {
    const debitChecked = mountRadio();
    expect(document.activeElement).toBe(debitChecked.get('#x-type-debit').element);
    debitChecked.unmount();

    const creditChecked = mountRadio({ modelValue: 'credit' });
    expect(document.activeElement).toBe(creditChecked.get('#x-type-credit').element);
    creditChecked.unmount();
  });

  it('focuses the "any" radio when it is the checked one', () => {
    const wrapper = mountRadio({ anyLabel: 'Any', modelValue: undefined });

    expect(document.activeElement).toBe(wrapper.get('#x-type-any').element);
    wrapper.unmount();
  });

  it('shows a visible legend only when given one, else a hidden one naming the group', () => {
    const plain = mountRadio();
    const legended = mountRadio({ legend: 'Type' });

    expect(plain.find('.form-label').exists()).toBe(false);
    expect(plain.get('legend.visually-hidden').text()).toBe('Type');
    expect(legended.get('legend.form-label').text()).toBe('Type');
    plain.unmount();
    legended.unmount();
  });

  it('shares one name across the radios so they form a native group', () => {
    const wrapper = mountRadio({ anyLabel: 'Any' });

    const name = wrapper.get('#x-type-debit').attributes('name');
    expect(name).toBeTruthy();
    expect(wrapper.get('#x-type-credit').attributes('name')).toBe(name);
    expect(wrapper.get('#x-type-any').attributes('name')).toBe(name);
    wrapper.unmount();
  });

  it('omits the "any" radio unless anyLabel is given', () => {
    const wrapper = mountRadio();

    expect(wrapper.find('#x-type-any').exists()).toBe(false);
    wrapper.unmount();
  });

  it('adds a leading "any" radio with the given label when anyLabel is given', () => {
    const wrapper = mountRadio({ anyLabel: 'Any', modelValue: undefined });

    expect(wrapper.get('label[for="x-type-any"]').text()).toBe('Any');
    expect((wrapper.get('#x-type-any').element as HTMLInputElement).checked).toBe(true);
    wrapper.unmount();
  });

  it('emits undefined when the "any" radio is chosen', async () => {
    const wrapper = mountRadio({ anyLabel: 'Any' });

    await wrapper.get('#x-type-any').setValue(true);

    expect(wrapper.emitted('update:modelValue')).toEqual([[undefined]]);
    wrapper.unmount();
  });
});
