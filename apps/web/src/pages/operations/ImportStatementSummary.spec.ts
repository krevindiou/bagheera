import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { components } from '../../api/schema';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import ImportStatementSummary from './ImportStatementSummary.vue';

type Statement = components['schemas']['StatementSummaryDto'];

const statement: Statement = {
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  debitTotal: 200.5,
  creditTotal: 1500,
  closing: null,
  accountCheck: 'unknown',
  otherAccountId: null,
};

function mountSummary(overrides: Partial<Statement> = {}, otherAccountName: string | null = null) {
  return mount(ImportStatementSummary, {
    ...withGlobalPlugins(),
    props: { statement: { ...statement, ...overrides }, currency: 'EUR', otherAccountName },
  });
}

describe('ImportStatementSummary', () => {
  it('says that the figures are those of the file', () => {
    expect(mountSummary().find('h2').text()).toBe('In the file');
  });

  it('shows the period and the totals of debits and credits, tinted like the dashboard figures', () => {
    const wrapper = mountSummary();

    expect(wrapper.find('[data-testid="import-period"]').text()).toBe(
      'Period: 3/1/2026 – 3/31/2026',
    );
    const debits = wrapper.find('[data-testid="import-debits-value"]');
    expect(debits.text()).toBe('€200.50');
    expect(debits.classes()).toContain('text-danger');
    const credits = wrapper.find('[data-testid="import-credits-value"]');
    expect(credits.text()).toBe('€1,500.00');
    expect(credits.classes()).toContain('text-success');
  });

  it('says what the net movement is made of', () => {
    const net = mountSummary().find('[data-testid="import-net"]');
    expect(net.text()).toContain('Net movement');
    expect(net.text()).toContain('Credits − debits');
  });

  it('is made of the same figure cards as the dashboard', () => {
    const wrapper = mountSummary();
    expect(wrapper.findAll('.stat-card')).toHaveLength(3);
    expect(wrapper.find('[data-testid="import-debits"]').classes()).toContain('stat-card');
  });

  it.each([
    [1500, 200.5, '€1,299.50', 'text-success'],
    [100, 250.25, '-€150.25', 'text-danger'],
    [80, 80, '€0.00', ''],
  ])(
    'shows the difference between credits and debits (%d, %d)',
    (creditTotal, debitTotal, shown, color) => {
      const net = mountSummary({ creditTotal, debitTotal }).find(
        '[data-testid="import-net-value"]',
      );

      expect(net.text()).toBe(shown);
      expect(net.classes().filter((name) => name.startsWith('text-'))).toEqual(
        color ? [color] : [],
      );
    },
  );

  it('shows no period for a file without a valid row', () => {
    const wrapper = mountSummary({ periodStart: null, periodEnd: null });
    expect(wrapper.find('[data-testid="import-period"]').exists()).toBe(false);
  });

  it('shows no balance when the file gives no closing balance', () => {
    const wrapper = mountSummary();
    expect(wrapper.find('[data-testid="import-closing"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-expected"]').exists()).toBe(false);
  });

  it('says the balances match', () => {
    const wrapper = mountSummary({
      closing: { date: '2026-03-31', amount: 1299.5, expected: 1299.5 },
    });

    expect(wrapper.find('[data-testid="import-closing"]').text()).toContain('€1,299.50');
    expect(wrapper.find('[data-testid="import-closing"]').text()).toContain('On 3/31/2026');
    expect(wrapper.find('[data-testid="import-expected"]').text()).toContain('€1,299.50');
    expect(wrapper.find('[data-testid="import-balance-matches"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="import-balance-differs"]').exists()).toBe(false);
  });

  it('shows the closing balance alone when the account has nothing to compare it with', () => {
    const wrapper = mountSummary({ closing: { date: '2026-03-31', amount: 1300, expected: null } });

    expect(wrapper.find('[data-testid="import-closing"]').text()).toContain('€1,300.00');
    expect(wrapper.find('[data-testid="import-expected"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-balance-matches"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="import-balance-differs"]').exists()).toBe(false);
  });

  it.each([
    [1300, 1250.25, '€49.75'],
    [1250.25, 1300, '€49.75'],
  ])('says by how much the balances differ (%d against %d)', (amount, expected, difference) => {
    const wrapper = mountSummary({ closing: { date: '2026-03-31', amount, expected } });

    expect(wrapper.find('[data-testid="import-balance-differs"]').text()).toContain(difference);
    expect(wrapper.find('[data-testid="import-balance-matches"]').exists()).toBe(false);
  });

  it.each(['unknown', 'same'] as const)(
    'warns about nothing when the account check is %s',
    (accountCheck) => {
      expect(
        mountSummary({ accountCheck }).find('[data-testid="import-account-warning"]').exists(),
      ).toBe(false);
    },
  );

  it('warns when the file names another account than the one remembered', () => {
    const warning = mountSummary({ accountCheck: 'different' }).find(
      '[data-testid="import-account-warning"]',
    );
    expect(warning.attributes('role')).toBe('alert');
    expect(warning.text()).toContain('another account');
  });

  it.each(['different', 'elsewhere'] as const)(
    'asks whether to import anyway when the account check is %s',
    async (accountCheck) => {
      const wrapper = mountSummary({ accountCheck });
      const box = wrapper.find('[data-testid="import-accept-mismatch"]');
      expect((box.element as HTMLInputElement).checked).toBe(false);

      await box.setValue(true);

      expect(wrapper.emitted('update:accepted')).toEqual([[true]]);
    },
  );

  it('offers nothing to accept when no warning is shown', () => {
    expect(mountSummary().find('[data-testid="import-accept-mismatch"]').exists()).toBe(false);
  });

  it('shows the box checked once the Member accepted', () => {
    const wrapper = mount(ImportStatementSummary, {
      ...withGlobalPlugins(),
      props: {
        statement: { ...statement, accountCheck: 'different' },
        currency: 'EUR',
        otherAccountName: null,
        accepted: true,
      },
    });
    const box = wrapper.find('[data-testid="import-accept-mismatch"]');
    expect((box.element as HTMLInputElement).checked).toBe(true);
  });

  it('names the account the file was imported into before', () => {
    const wrapper = mountSummary(
      { accountCheck: 'elsewhere', otherAccountId: 'a2' },
      'Chase — Savings',
    );
    expect(wrapper.find('[data-testid="import-account-warning"]').text()).toContain(
      'Chase — Savings',
    );
  });

  it('warns without a name when that account is not known to the page', () => {
    const wrapper = mountSummary({ accountCheck: 'elsewhere', otherAccountId: 'a2' });
    expect(wrapper.find('[data-testid="import-account-warning"]').text()).toContain(
      'another of your accounts',
    );
  });
});
