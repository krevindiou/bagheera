import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import PasswordInput from './PasswordInput.vue';

describe('PasswordInput', () => {
  it('renders a password-type input with the given id and value', () => {
    const wrapper = mount(PasswordInput, {
      ...withGlobalPlugins(),
      props: { id: 'pwd', modelValue: 'secret' },
    });
    const input = wrapper.find('input');
    expect(input.attributes('type')).toBe('password');
    expect(input.attributes('id')).toBe('pwd');
    expect(input.element.value).toBe('secret');
  });

  it('emits update:modelValue as the member types', async () => {
    const wrapper = mount(PasswordInput, {
      ...withGlobalPlugins(),
      props: { id: 'pwd', modelValue: '' },
    });
    await wrapper.find('input').setValue('hunter2');
    expect(wrapper.emitted('update:modelValue')).toEqual([['hunter2']]);
  });

  it("toggles visibility, swapping the input type and the toggle button's label", async () => {
    const wrapper = mount(PasswordInput, {
      ...withGlobalPlugins(),
      props: { id: 'pwd', modelValue: 'secret' },
    });
    const toggle = wrapper.find('button');
    expect(toggle.attributes('aria-label')).toBe('Show password');
    expect(toggle.attributes('aria-pressed')).toBe('false');

    await toggle.trigger('click');
    expect(wrapper.find('input').attributes('type')).toBe('text');
    expect(toggle.attributes('aria-label')).toBe('Hide password');
    expect(toggle.attributes('aria-pressed')).toBe('true');

    await toggle.trigger('click');
    expect(wrapper.find('input').attributes('type')).toBe('password');
  });

  it('passes extra attributes through to the inner input, not the wrapper', () => {
    const wrapper = mount(PasswordInput, {
      ...withGlobalPlugins(),
      props: { id: 'pwd', modelValue: '' },
      attrs: { placeholder: 'Password' },
    });
    expect(wrapper.find('input').attributes('placeholder')).toBe('Password');
    expect(wrapper.attributes('placeholder')).toBeUndefined();
  });
});
