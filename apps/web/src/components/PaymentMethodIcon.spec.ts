import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { PAYMENT_METHOD_ID, type PaymentMethod } from '../domain/referenceData';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import PaymentMethodIcon from './PaymentMethodIcon.vue';

const paymentMethods = [
  { id: PAYMENT_METHOD_ID.CREDIT_CARD, name: 'Credit card', type: 'debit' },
] as PaymentMethod[];

describe('PaymentMethodIcon', () => {
  it('draws the method’s icon, named after the method', () => {
    const wrapper = mount(PaymentMethodIcon, {
      ...withGlobalPlugins(),
      props: { id: PAYMENT_METHOD_ID.CREDIT_CARD, paymentMethods },
    });

    const icon = wrapper.get('[role="img"]');
    expect(icon.attributes('aria-label')).toBe('Credit card');
    expect(icon.attributes('title')).toBe('Credit card');
    expect(icon.find('svg').exists()).toBe(true);
  });

  it('renders nothing for an id without an icon', () => {
    const wrapper = mount(PaymentMethodIcon, {
      ...withGlobalPlugins(),
      props: { id: 'unknown', paymentMethods },
    });

    expect(wrapper.find('[role="img"]').exists()).toBe(false);
  });
});
