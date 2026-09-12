import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => false),
  startAuthentication: vi.fn(),
}));

import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from '../../api/client';
import {
  readLastAttemptedEmail,
  rememberAttemptedEmail,
} from '../../composables/useLastAttemptedEmail';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import { useSessionStore } from '../../stores/session.store';
import SignInPage from './SignInPage.vue';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

describe('SignInPage', () => {
  beforeEach(async () => {
    apiClient.POST.mockReset();
    // Navigating to "home" (requiresAuth) after a successful sign-in runs
    // the real router guard, which restores the session via GET /auth/me
    // since a fresh store starts unrestored — default to "no session" and
    // have the success-path tests below override it, or the guard's own
    // restore() overwrites the member sign-in just set.
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, undefined));
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    vi.mocked(startAuthentication).mockReset();
    useToast().toasts.splice(0);
    window.sessionStorage.clear();
    await router.push({ name: 'sign-in' });
  });

  it('prefills the email from a previously remembered attempt', () => {
    rememberAttemptedEmail('member@example.com');
    const wrapper = mount(SignInPage, withGlobalPlugins());
    expect((wrapper.find('#sign-in-email').element as HTMLInputElement).value).toBe(
      'member@example.com',
    );
  });

  it('signs in, remembers the email, shows a toast, and goes home', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    apiClient.GET.mockResolvedValue(jsonResult(200, { email: 'member@example.com' }));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await wrapper.find('#sign-in-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/auth/sign-in', {
      body: { email: 'member@example.com', password: 'hunter2' },
    });
    expect(useSessionStore().isAuthenticated).toBe(true);
    expect(readLastAttemptedEmail()).toBe('member@example.com');
    expect(useToast().toasts[0]?.text).toBe('Signed in.');
    await waitForRouteName(router, 'home');
  });

  it('shows an inactive-account banner with a working resend button on a 403', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(403));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await wrapper.find('#sign-in-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Your account is not activated yet.');

    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    await wrapper.find('.alert-warning button').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(apiClient.POST).toHaveBeenCalledWith('/members/resend-activation', {
      body: { email: 'member@example.com', password: 'hunter2' },
    });
    expect(wrapper.text()).toContain('A new activation email has been sent.');
  });

  it('shows an invalid-credentials banner on any other sign-in failure', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await wrapper.find('#sign-in-password').setValue('wrong');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Invalid email or password');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  describe('passkey sign-in', () => {
    it("hides the passkey button when the browser doesn't support WebAuthn", () => {
      const wrapper = mount(SignInPage, withGlobalPlugins());
      expect(wrapper.find('button.btn-outline-secondary').exists()).toBe(false);
    });

    it('requires an email before attempting a passkey sign-in', async () => {
      vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
      const wrapper = mount(SignInPage, withGlobalPlugins());
      await wrapper.find('button.btn-outline-secondary').trigger('click');

      expect(wrapper.text()).toContain('Enter your email address first.');
      expect(apiClient.POST).not.toHaveBeenCalled();
    });

    it('signs in with a passkey end to end', async () => {
      vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
      apiClient.POST.mockImplementation(async (path: string) => {
        if (path === '/webauthn/authentication/options') return jsonResult(200, {});
        if (path === '/webauthn/authentication/verify') return jsonResult(200);
        return jsonResult(404);
      });
      vi.mocked(startAuthentication).mockResolvedValueOnce(
        {} as unknown as Awaited<ReturnType<typeof startAuthentication>>,
      );
      apiClient.GET.mockResolvedValue(jsonResult(200, { email: 'member@example.com' }));

      const wrapper = mount(SignInPage, withGlobalPlugins());
      await wrapper.find('#sign-in-email').setValue('member@example.com');
      await wrapper.find('button.btn-outline-secondary').trigger('click');
      await flushPromises();
      await wrapper.vm.$nextTick();

      expect(useSessionStore().isAuthenticated).toBe(true);
      await waitForRouteName(router, 'home');
    });

    it('silently abandons a cancelled passkey prompt', async () => {
      vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
      apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
      vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));

      const wrapper = mount(SignInPage, withGlobalPlugins());
      await wrapper.find('#sign-in-email').setValue('member@example.com');
      await wrapper.find('button.btn-outline-secondary').trigger('click');
      await flushPromises();
      await wrapper.vm.$nextTick();

      expect(useSessionStore().isAuthenticated).toBe(false);
      expect(wrapper.find('.alert').exists()).toBe(false);
    });
  });
});
