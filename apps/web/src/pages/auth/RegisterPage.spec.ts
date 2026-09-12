import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { readLastAttemptedEmail } from '../../composables/useLastAttemptedEmail';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import RegisterPage from './RegisterPage.vue';

const apiClient = asMockedApiClient(realApiClient);

async function fillValidForm(wrapper: VueWrapper) {
  await wrapper.find('#register-email').setValue('member@example.com');
  await wrapper.find('#register-country').setValue('FR');
  await wrapper.find('#register-password').setValue('longenough1');
  await wrapper.find('#register-password-confirmation').setValue('longenough1');
}

describe('RegisterPage', () => {
  beforeEach(async () => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
    window.sessionStorage.clear();
    await router.push({ name: 'register' });
  });

  it('lists every ISO country as an option', () => {
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    expect(wrapper.findAll('#register-country option').length).toBeGreaterThan(200);
  });

  it('registers, remembers the email, shows a toast, and redirects to sign-in', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/members/register', {
      body: {
        email: 'member@example.com',
        country: 'FR',
        password: 'longenough1',
        passwordConfirmation: 'longenough1',
      },
    });
    expect(readLastAttemptedEmail()).toBe('member@example.com');
    expect(useToast().toasts[0]?.text).toBe(
      "If this email isn't already registered, you'll receive a link to activate your account.",
    );
    await waitForRouteName(router, 'sign-in');
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

  it('shows a validation error for every required field left blank', async () => {
    // Country isn't included here: it defaults to a browser-locale guess
    // (see useCountryOptions), so it's never actually blank at submit time.
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(wrapper.text()).toContain('Password must be at least 8 characters.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows a validation error and doesn't submit for mismatched passwords", async () => {
    const wrapper = mount(RegisterPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await wrapper.find('#register-password-confirmation').setValue('different1');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Passwords don't match.");
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
