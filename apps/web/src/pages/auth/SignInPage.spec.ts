import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
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
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
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

  it('shows a validation error for a blank email field', async () => {
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('This field is required.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows a warning and hides the form when the browser doesn't support WebAuthn", () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    const wrapper = mount(SignInPage, withGlobalPlugins());

    expect(wrapper.text()).toContain("This browser doesn't support passkeys");
    expect(wrapper.find('#sign-in-email').exists()).toBe(false);
  });

  it('signs in with a passkey end to end', async () => {
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
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/authentication/options', {
      body: { email: 'member@example.com' },
    });
    expect(readLastAttemptedEmail()).toBe('member@example.com');
    expect(useSessionStore().isAuthenticated).toBe(true);
    expect(useToast().toasts[0]?.text).toBe('Signed in.');
    await waitForRouteName(router, 'home');
  });

  it('shows a rate-limit banner, distinct from invalid-credentials, on a 429 from options', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(429));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Too many attempts. Please wait a minute and try again.');
    expect(useSessionStore().isAuthenticated).toBe(false);
    expect(vi.mocked(startAuthentication)).not.toHaveBeenCalled();
  });

  it('shows an invalid-credentials banner when options fails', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Sign-in failed');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  it('shows an invalid-credentials banner when verify fails', async () => {
    apiClient.POST.mockImplementation(async (path: string) => {
      if (path === '/webauthn/authentication/options') return jsonResult(200, {});
      return jsonResult(401);
    });
    vi.mocked(startAuthentication).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startAuthentication>>,
    );

    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Sign-in failed');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  it('silently abandons a cancelled passkey prompt', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
    vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));

    const wrapper = mount(SignInPage, withGlobalPlugins());
    await wrapper.find('#sign-in-email').setValue('member@example.com');
    await submitAndSettle(wrapper);
    await flushPromises();

    expect(useSessionStore().isAuthenticated).toBe(false);
    expect(wrapper.find('.alert').exists()).toBe(false);
  });
});
