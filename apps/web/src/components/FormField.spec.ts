import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FormField from './FormField.vue';

function mountField(props: { error?: string; hint?: string } = {}, attrs = {}) {
  return mount(FormField, {
    props: { label: 'Amount', for: 'amount', ...props },
    attrs,
    slots: { default: '<input id="amount" class="form-control" />' },
  });
}

describe('FormField', () => {
  it('renders the label tied to the control, and the control itself', () => {
    const wrapper = mountField();

    expect(wrapper.get('label').text()).toBe('Amount');
    expect(wrapper.get('label').attributes('for')).toBe('amount');
    expect(wrapper.get('label').classes()).toContain('form-label');
    expect(wrapper.find('input#amount').exists()).toBe(true);
    expect(wrapper.classes()).toContain('mb-3');
  });

  it('shows no error or hint by default', () => {
    const wrapper = mountField();

    expect(wrapper.find('.invalid-feedback').exists()).toBe(false);
    expect(wrapper.find('.form-text').exists()).toBe(false);
  });

  it('shows the error as d-block feedback, so an input group does not hide it', () => {
    const feedback = mountField({ error: 'Too high' }).get('.invalid-feedback');

    expect(feedback.text()).toBe('Too high');
    expect(feedback.classes()).toContain('d-block');
  });

  it('shows the hint, after the error when both are present', () => {
    const wrapper = mountField({ error: 'Too high', hint: 'Up to 50' });
    const children = Array.from((wrapper.element as HTMLElement).children).map(
      (el) => el.className,
    );

    expect(wrapper.get('.form-text').text()).toBe('Up to 50');
    expect(children.indexOf('form-text')).toBeGreaterThan(
      children.indexOf('invalid-feedback d-block'),
    );
  });

  it('forwards attributes and classes to the root', () => {
    const wrapper = mountField({}, { class: 'flex-grow-1', 'data-testid': 'field' });

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['mb-3', 'flex-grow-1']));
    expect(wrapper.attributes('data-testid')).toBe('field');
  });
});
