import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusIcon from './StatusIcon.vue';

describe('StatusIcon', () => {
  it.each([
    ['reconciled', 'reconciled-icon'],
    ['scheduler', 'scheduler-icon'],
  ] as const)('exposes the %s badge by test id and accessible name', (kind, testId) => {
    const wrapper = mount(StatusIcon, { props: { kind, label: 'A label' } });

    const badge = wrapper.get(`[data-testid="${testId}"]`);
    expect(badge.attributes('role')).toBe('img');
    expect(badge.attributes('aria-label')).toBe('A label');
    expect(badge.attributes('title')).toBe('A label');
    expect(badge.find('svg').exists()).toBe(true);
  });

  it('draws a different glyph per kind', () => {
    const reconciled = mount(StatusIcon, { props: { kind: 'reconciled', label: 'x' } });
    const scheduler = mount(StatusIcon, { props: { kind: 'scheduler', label: 'x' } });

    expect(reconciled.html()).not.toBe(scheduler.html());
    expect(scheduler.find('circle').exists()).toBe(true);
  });
});
