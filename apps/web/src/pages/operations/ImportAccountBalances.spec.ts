import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import ImportAccountBalances from './ImportAccountBalances.vue';

describe('ImportAccountBalances', () => {
  it('shows the balance and the reconciled balance after the import, each with its current value', () => {
    const wrapper = mount(ImportAccountBalances, {
      ...withGlobalPlugins(),
      props: {
        current: { balance: 100, reconciledBalance: 60 },
        projected: { balance: 1_402_500, reconciledBalance: 1_002_500 },
        currency: 'EUR',
      },
    });

    expect(wrapper.find('h2').text()).toBe('Account after the import');
    expect(wrapper.find('[data-testid="import-after-balance"]').text()).toBe('€140.25');
    expect(wrapper.find('[data-testid="import-now-balance"]').text()).toBe('Now €100.00');
    expect(wrapper.find('[data-testid="import-after-reconciled"]').text()).toBe('€100.25');
    expect(wrapper.find('[data-testid="import-now-reconciled"]').text()).toBe('Now €60.00');
  });
});
