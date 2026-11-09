import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthLayout from './AuthLayout.vue';

function mountLayout() {
  return mount(AuthLayout, {
    slots: { default: '<h1>Sign in</h1>' },
    // Its own spec covers it; here it would need the API client.
    global: { stubs: { LanguageSwitcher: true } },
  });
}

describe('AuthLayout', () => {
  it('renders the page inside the card, with no brand mark', () => {
    const card = mountLayout().find('.auth-card');
    expect(card.find('h1').text()).toBe('Sign in');
    expect(card.find('.logo-mark').exists()).toBe(false);
  });

  it('draws a decorative background behind the card', () => {
    const background = mountLayout().find('.auth-bg');
    expect(background.exists()).toBe(true);
    expect(background.attributes('aria-hidden')).toBe('true');
  });
});
