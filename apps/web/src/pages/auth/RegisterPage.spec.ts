import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
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
    useToast().toasts.splice(0);
    localStorage.clear();
    await router.push({ name: 'register', params: { locale: 'en' } });
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

  it('registers, shows a toast, and redirects to sign-in', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 201 }),
    });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/members/register', {
      body: { email: 'member@example.com', country: 'FR', locale: 'en' },
    });
    expect(useToast().toasts[0]?.text).toBe(
      "If this email isn't already registered, you'll receive a link to create your account.",
    );
    await waitForRouteName(router, 'sign-in');
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
});
