import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { router } from '../../router';
import RegisterPage from './RegisterPage.vue';

const apiClient = asMockedApiClient(realApiClient);

async function fillValidForm(wrapper: VueWrapper) {
  await wrapper.find('#register-email').setValue('member@example.com');
  await wrapper.find('#register-country').setValue('FR');
}

describe('RegisterPage', () => {
  beforeEach(async () => {
    apiClient.POST.mockReset();
    localStorage.clear();
    await router.push({ name: 'register', params: { locale: 'en' } });
  });

  it('points members who already have an account to sign-in', () => {
    const prompt = mount(RegisterPage, withGlobalPlugins()).get('[data-testid="sign-in-prompt"]');
    expect(prompt.text()).toBe('Already have an account? Sign in');
    expect(prompt.get('a').attributes('href')).toBe('/en/sign-in');
  });

  it('lists every ISO country as an option', () => {
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    expect(wrapper.findAll('#register-country option').length).toBeGreaterThan(200);
  });

  // Native `autofocus` only fires on a full page load; reached through a
  // client-side navigation (e.g. the sign-in page's link), focus would stay
  // on the link that was clicked.
  it('focuses the email field when the page mounts', () => {
    const wrapper = mount(RegisterPage, { ...withGlobalPlugins(), attachTo: document.body });

    expect(document.activeElement).toBe(wrapper.find('#register-email').element);
    wrapper.unmount();
  });

  it('registers and replaces the form with a persistent check-your-inbox panel', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 201 }),
    });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/members/register', {
      body: {
        email: 'member@example.com',
        country: 'FR',
        locale: 'en',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    expect(wrapper.text()).toContain(
      "If member@example.com isn't already registered, you'll receive a link there to create your account.",
    );
    expect(wrapper.find('#register-email').exists()).toBe(false);
    // Stays put: the only link to the activation email is on this panel, so
    // navigating away (e.g. to a toast-driven redirect) would lose it.
    expect(router.currentRoute.value.name).toBe('register');
  });

  it('lets the member go back to the form to use a different email', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 201 }),
    });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    await wrapper.find('button[type="button"].btn-outline-secondary').trigger('click');

    expect(wrapper.find('#register-email').exists()).toBe(true);
    expect((wrapper.find('#register-email').element as HTMLInputElement).value).toBe('');
  });

  it('sends the locale segment the page is currently shown under', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 201 }),
    });
    await router.push({ name: 'register', params: { locale: 'fr' } });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/members/register',
      expect.objectContaining({ body: expect.objectContaining({ locale: 'fr' }) }),
    );
  });

  it('shows a generic error and stays put when registration fails', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 409 }),
    });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
    expect(router.currentRoute.value.name).toBe('register');
  });

  it('shows a validation error for a blank email', async () => {
    // Country isn't included here: it defaults to a browser-locale guess
    // (see useCountryOptions), so it's never actually blank at submit time.
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('ties the blank-email error to the field for assistive technology', async () => {
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    const email = wrapper.get('#register-email');

    expect(email.attributes('aria-invalid')).toBeUndefined();
    expect(email.attributes('aria-describedby')).toBeUndefined();

    await submitAndSettle(wrapper);

    expect(email.attributes('aria-invalid')).toBe('true');
    expect(email.attributes('aria-describedby')).toBe('register-email-error');
  });
});
