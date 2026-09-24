import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MoneyInput from './MoneyInput.vue';

function mountInput(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(MoneyInput, {
    props: { symbol: '$', modelValue: 12.5, ...props },
    attrs: { id: 'amount', ...attrs },
    attachTo: document.body,
  });
}

describe('MoneyInput', () => {
  it('shows the currency symbol beside a decimal number input holding the value', () => {
    const wrapper = mountInput();

    expect(wrapper.get('.input-group-text').text()).toBe('$');
    const input = wrapper.get('input');
    expect(input.attributes('type')).toBe('number');
    expect(input.attributes('inputmode')).toBe('decimal');
    expect(input.attributes('step')).toBe('0.01');
    expect((input.element as HTMLInputElement).value).toBe('12.5');
    wrapper.unmount();
  });

  it('puts attributes on the input, not the group', () => {
    const wrapper = mountInput({}, { 'data-testid': 'money' });

    expect(wrapper.get('input').attributes('id')).toBe('amount');
    expect(wrapper.get('input').attributes('data-testid')).toBe('money');
    expect(wrapper.get('.input-group').attributes('id')).toBeUndefined();
    wrapper.unmount();
  });

  it('marks the input invalid on request', () => {
    expect(mountInput({ invalid: true }).get('input').classes()).toContain('is-invalid');
    expect(mountInput().get('input').classes()).not.toContain('is-invalid');
  });

  it('emits the typed amount as a number', async () => {
    const wrapper = mountInput();

    await wrapper.get('input').setValue('7.25');

    expect(wrapper.emitted('update:modelValue')).toEqual([[7.25]]);
    wrapper.unmount();
  });

  it('forwards listeners such as blur to the input', async () => {
    let blurred = 0;
    const wrapper = mountInput({}, { onBlur: () => (blurred += 1) });

    await wrapper.get('input').trigger('blur');

    expect(blurred).toBe(1);
    wrapper.unmount();
  });

  it('focuses its input on request', () => {
    const wrapper = mountInput();

    (wrapper.vm as unknown as { focus: () => void }).focus();

    expect(document.activeElement).toBe(wrapper.get('input').element);
    wrapper.unmount();
  });
});
