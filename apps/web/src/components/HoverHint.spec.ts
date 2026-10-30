import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HoverHint from './HoverHint.vue';

function mountHint() {
  return mount(HoverHint, { props: { text: '→ Chase — Savings' }, slots: { default: 'Transfer' } });
}

describe('HoverHint', () => {
  it('shows its label, the bubble kept apart from it', () => {
    const wrapper = mountHint();

    expect(wrapper.get('.hint-label').text()).toBe('Transfer');
    expect(wrapper.get('.hint-label').find('[role="tooltip"]').exists()).toBe(false);
  });

  it('carries the extra text as a tooltip that describes the label', () => {
    const wrapper = mountHint();
    const bubble = wrapper.get('[role="tooltip"]');

    expect(bubble.text()).toBe('→ Chase — Savings');
    expect(wrapper.get('.hint').attributes('aria-describedby')).toBe(bubble.attributes('id'));
  });

  it('can be reached with the keyboard', () => {
    expect(mountHint().get('.hint').attributes('tabindex')).toBe('0');
  });

  it('closes on Escape, and opens again once the pointer or focus leaves', async () => {
    const wrapper = mountHint();
    const hint = wrapper.get('.hint');

    await hint.trigger('keydown', { key: 'Escape' });
    expect(hint.classes()).toContain('hint-dismissed');

    await hint.trigger('mouseleave');
    expect(hint.classes()).not.toContain('hint-dismissed');

    await hint.trigger('keydown', { key: 'Escape' });
    await hint.trigger('blur');
    expect(hint.classes()).not.toContain('hint-dismissed');
  });
});
