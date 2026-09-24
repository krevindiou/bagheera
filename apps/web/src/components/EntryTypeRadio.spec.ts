import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import EntryTypeRadio from './EntryTypeRadio.vue';

function mountRadio(props: { modelValue?: 'debit' | 'credit'; legend?: string } = {}) {
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

  it('focuses the debit radio when it appears', () => {
    const wrapper = mountRadio();

    expect(document.activeElement).toBe(wrapper.get('#x-type-debit').element);
    wrapper.unmount();
  });

  it('shows a legend only when given one', () => {
    const plain = mountRadio();
    const legended = mountRadio({ legend: 'Type' });

    expect(plain.find('.form-label').exists()).toBe(false);
    expect(legended.get('.form-label').text()).toBe('Type');
    plain.unmount();
    legended.unmount();
  });
});
