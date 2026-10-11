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

  it('gives the label an id a non-labelable control can reference via aria-labelledby', () => {
    const wrapper = mountField();

    expect(wrapper.get('label').attributes('id')).toBe('amount-label');
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

  it('gives the error and hint elements ids the control can be described by', () => {
    const wrapper = mountField({ error: 'Too high', hint: 'Up to 50' });

    expect(wrapper.get('.invalid-feedback').attributes('id')).toBe('amount-error');
    expect(wrapper.get('.form-text').attributes('id')).toBe('amount-hint');
  });

  it('has no aria-invalid or aria-describedby on the control by default', () => {
    const input = mountField().get('input#amount');

    expect(input.attributes('aria-invalid')).toBeUndefined();
    expect(input.attributes('aria-describedby')).toBeUndefined();
  });

  it('marks the matching control invalid and describes it by the error and hint shown', () => {
    const input = mountField({ error: 'Too high', hint: 'Up to 50' }).get('input#amount');

    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe('amount-error amount-hint');
  });

  it('describes the control by the hint alone when there is no error', () => {
    const input = mountField({ hint: 'Up to 50' }).get('input#amount');

    expect(input.attributes('aria-invalid')).toBeUndefined();
    expect(input.attributes('aria-describedby')).toBe('amount-hint');
  });

  it('clears aria-invalid and aria-describedby once the error and hint are gone', async () => {
    const wrapper = mountField({ error: 'Too high', hint: 'Up to 50' });
    await wrapper.setProps({ error: undefined, hint: undefined });
    const input = wrapper.get('input#amount');

    expect(input.attributes('aria-invalid')).toBeUndefined();
    expect(input.attributes('aria-describedby')).toBeUndefined();
  });

  it('merges its own id into an existing aria-describedby and leaves a pre-set aria-invalid alone', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Amount', for: 'amount', error: 'Too high' },
      slots: {
        default:
          '<input id="amount" aria-invalid="false" aria-describedby="custom-hint" class="form-control" />',
      },
    });
    const input = wrapper.get('input#amount');

    expect(input.attributes('aria-invalid')).toBe('false');
    expect(input.attributes('aria-describedby')).toBe('custom-hint amount-error');
  });

  it('does nothing when no control matches `for` by id', () => {
    expect(() =>
      mount(FormField, {
        props: { label: 'Amount', for: 'does-not-exist', error: 'Too high' },
        slots: { default: '<input id="amount" class="form-control" />' },
      }),
    ).not.toThrow();
  });
});
