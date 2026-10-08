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
    // The guard on "home" calls GET /auth/me: default to "no session",
    // overridden by the success-path tests.
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, undefined));
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    vi.mocked(startAuthentication).mockReset();
    useToast().toasts.splice(0);
    await router.push({ name: 'sign-in' });
  });

  // Usernameless: no email field to probe which addresses have an account.
  it('asks for no email — just the passkey button', () => {
    const wrapper = mount(SignInPage, withGlobalPlugins());
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.find('button[type="submit"]').text()).toBe('Sign in with a passkey');
  });

  it("shows a warning and hides the form when the browser doesn't support WebAuthn", () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    const wrapper = mount(SignInPage, withGlobalPlugins());

    expect(wrapper.text()).toContain("This browser doesn't support passkeys");
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('signs in with a passkey end to end, sending no identifier', async () => {
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
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/authentication/options');
    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/authentication/verify', {
      body: { response: {} },
    });
    expect(useSessionStore().isAuthenticated).toBe(true);
    expect(useToast().toasts[0]?.text).toBe('Signed in.');
    await waitForRouteName(router, 'home');
  });

  it('shows a rate-limit banner, distinct from invalid-credentials, on a 429 from options', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(429));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Too many attempts. Please wait a minute and try again.');
    expect(useSessionStore().isAuthenticated).toBe(false);
    expect(vi.mocked(startAuthentication)).not.toHaveBeenCalled();
  });

  it('shows an invalid-credentials banner when options fails', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Sign-in failed');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  it('shows an invalid-credentials banner, without prompting, when options come back empty', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, undefined));
    const wrapper = mount(SignInPage, withGlobalPlugins());
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Sign-in failed');
    expect(vi.mocked(startAuthentication)).not.toHaveBeenCalled();
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
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Sign-in failed');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  it('silently abandons a cancelled passkey prompt, re-enabling the button', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
    vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));

    const wrapper = mount(SignInPage, withGlobalPlugins());
    await submitAndSettle(wrapper);
    await flushPromises();

    expect(useSessionStore().isAuthenticated).toBe(false);
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });
});
