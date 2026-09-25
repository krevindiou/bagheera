import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { formatMoney } from '../pages/operations/money';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import StatCard from './StatCard.vue';

type Props = InstanceType<typeof StatCard>['$props'];

function mountCard(props: Partial<Props> = {}, options: Record<string, unknown> = {}) {
  return mount(StatCard, {
    ...withGlobalPlugins(),
    props: { label: 'Balance', amount: 1234.5, currency: 'USD', ...props },
    ...options,
  });
}

describe('StatCard', () => {
  it('shows the label and the formatted amount in a card', () => {
    const wrapper = mountCard();

    expect(wrapper.classes()).toContain('stat-card');
    expect(wrapper.get('.stat-label').text()).toBe('Balance');
    expect(wrapper.get('.stat-value').text()).toBe(formatMoney(1234.5, 'USD'));
  });

  it('is a chip when asked to', () => {
    const wrapper = mountCard({ variant: 'chip' });

    expect(wrapper.classes()).toContain('stat-chip');
    expect(wrapper.classes()).not.toContain('stat-card');
  });

  it('tints a negative amount red and leaves others untinted', () => {
    expect(mountCard({ amount: -5 }).get('.stat-value').classes()).toContain('text-danger');
    expect(mountCard({ amount: 5 }).get('.stat-value').classes()).not.toContain('text-danger');
  });

  it('marks the figure as primary on request', () => {
    expect(mountCard({ primary: true }).get('.stat-value').classes()).toContain(
      'stat-value-primary',
    );
    expect(mountCard().get('.stat-value').classes()).not.toContain('stat-value-primary');
  });

  it('renders the Reconciled footnote, not tinted, with its own test ids', () => {
    const wrapper = mountCard({
      amount: -5,
      reconciled: -2,
      valueTestid: 'value',
      reconciledTestid: 'reconciled',
    });

    expect(wrapper.get('.stat-footnote-label').text()).toBe('Reconciled');
    expect(wrapper.get('[data-testid="reconciled"]').text()).toBe(formatMoney(-2, 'USD'));
    expect(wrapper.get('[data-testid="reconciled"]').classes()).not.toContain('text-danger');
    expect(wrapper.get('[data-testid="value"]').classes()).toContain('stat-value');
  });

  it('shows a reconciled amount of zero', () => {
    expect(mountCard({ reconciled: 0 }).find('.stat-footnote-value').exists()).toBe(true);
  });

  it('has no footnote without a reconciled amount or footnote slot', () => {
    expect(mountCard().find('.stat-footnote').exists()).toBe(false);
  });

  it('lets the footnote slot replace the Reconciled footnote', () => {
    const wrapper = mountCard(
      { reconciled: 10 },
      { slots: { footnote: '<span class="custom">Shop · 2026-09-24</span>' } },
    );

    expect(wrapper.get('.stat-footnote .custom').text()).toBe('Shop · 2026-09-24');
    expect(wrapper.find('.stat-footnote-value').exists()).toBe(false);
  });

  it('renders the default slot below the figure', () => {
    const wrapper = mountCard({}, { slots: { default: '<i class="extra"></i>' } });

    expect(wrapper.find('.extra').exists()).toBe(true);
  });

  it.each([
    ['up', 'text-success', 'stat-trend-badge-success'],
    ['down', 'text-danger', 'stat-trend-badge-danger'],
  ] as const)('trend %s tints the figure and adds a badge', (trend, tone, badge) => {
    const wrapper = mountCard({ trend });

    expect(wrapper.get('.stat-value').classes()).toContain(tone);
    expect(wrapper.get('.stat-trend-badge').classes()).toContain(badge);
    expect(wrapper.find('.stat-trend-badge svg').exists()).toBe(true);
  });

  it('has no trend badge by default', () => {
    expect(mountCard().find('.stat-trend-badge').exists()).toBe(false);
  });

  it('is a router link when given a destination, forwarding attributes to the root', () => {
    const wrapper = mountCard(
      { to: { name: 'sign-in', params: { locale: 'en' } } },
      { attrs: { 'data-testid': 'tile', class: 'acct-tile' } },
    );

    expect(wrapper.element.tagName).toBe('A');
    expect(wrapper.attributes('href')).toContain('/en');
    expect(wrapper.attributes('data-testid')).toBe('tile');
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['stat-card', 'acct-tile']));
  });

  it('is a plain div without a destination', () => {
    const wrapper = mountCard();

    expect(wrapper.element.tagName).toBe('DIV');
    expect(wrapper.attributes('to')).toBeUndefined();
  });
});
