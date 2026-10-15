import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn(),
}));

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import { useSessionStore } from '../../stores/session.store';
import ActivatePage from './ActivatePage.vue';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

describe('ActivatePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, undefined));
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    vi.mocked(startRegistration).mockReset();
    useToast().toasts.splice(0);
  });

  it('redirects to register with an error toast when the link has no key', async () => {
    await router.push({ name: 'activate' });
    mount(ActivatePage, withGlobalPlugins());
    await waitForRouteName(router, 'register');

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe(
      'This link is invalid or has expired. Enter your email to get a new one.',
    );
  });

  it('neither toasts an error nor redirects to sign-in when remounted signed in without a key', async () => {
    // Signing in remounts the page inside the app shell, key already gone.
    await router.push({ name: 'activate' });
    const plugins = withGlobalPlugins();
    useSessionStore().setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
    const wrapper = mount(ActivatePage, plugins);
    await wrapper.vm.$nextTick();
    await router.isReady();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.name).toBe('activate');
    expect(useToast().toasts).toHaveLength(0);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('shows a Continue button instead of auto-running the ceremony — it needs a real user gesture', async () => {
    // The ceremony needs a user gesture (see ActivatePage.vue).
    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.find('button.btn-primary').exists()).toBe(true);
  });

  it("shows a warning instead of the Continue button when the browser doesn't support WebAuthn", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="alert"]').text()).toContain(
      "This browser doesn't support passkeys",
    );
    expect(wrapper.find('button.btn-primary').exists()).toBe(false);
    expect(router.currentRoute.value.name).toBe('activate');
    expect(useToast().toasts).toHaveLength(0);
  });

  it('drops the key from the address bar while waiting for the click, and still uses it', async () => {
    apiClient.POST.mockResolvedValue(jsonResult(200, {}));
    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await router.isReady();
    await vi.waitFor(() => expect(router.currentRoute.value.query.key).toBeUndefined());
    expect(router.currentRoute.value.name).toBe('activate');

    vi.mocked(startRegistration).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startRegistration>>,
    );
    await wrapper.find('button.btn-primary').trigger('click');
    await vi.waitFor(() =>
      expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/signup/options', {
        body: { key: 'abc123' },
      }),
    );
  });

  it('creates the account and lands signed in once the button is clicked', async () => {
    apiClient.POST.mockImplementation(async (path: string) => {
      if (path === '/webauthn/signup/options') return jsonResult(200, {});
      if (path === '/webauthn/signup/verify') return jsonResult(200);
      return jsonResult(404);
    });
    vi.mocked(startRegistration).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startRegistration>>,
    );
    apiClient.GET.mockResolvedValue(jsonResult(200, { email: 'member@example.com' }));

    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button.btn-primary').trigger('click');
    await waitForRouteName(router, 'home');

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/signup/options', {
      body: { key: 'abc123' },
    });
    expect(useSessionStore().isAuthenticated).toBe(true);
    expect(useToast().toasts[0]?.text).toBe('Account created. You are now signed in.');
  });

  it('shows an error toast and redirects to register when the key is rejected', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    await router.push({ name: 'activate', query: { key: 'expired' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button.btn-primary').trigger('click');
    await waitForRouteName(router, 'register');

    expect(useToast().toasts[0]?.text).toBe(
      'This link is invalid or has expired. Enter your email to get a new one.',
    );
  });

  it('stays on the page with the key kept for a retry when the passkey prompt is cancelled', async () => {
    apiClient.POST.mockResolvedValue(jsonResult(200, {}));
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'));

    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button.btn-primary').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true));

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Passkey creation was cancelled. Click Continue to try again.',
    );
    expect(router.currentRoute.value.name).toBe('activate');
    expect(useToast().toasts).toHaveLength(0);
    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeUndefined();

    apiClient.POST.mockClear();
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'));
    await wrapper.find('button.btn-primary').trigger('click');
    await vi.waitFor(() =>
      expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/signup/options', {
        body: { key: 'abc123' },
      }),
    );
  });

  it('stays on the page with a too-many-attempts message when rate-limited', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(429));

    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button.btn-primary').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true));

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Too many attempts. Please wait a minute and try again.',
    );
    expect(router.currentRoute.value.name).toBe('activate');
    expect(useToast().toasts).toHaveLength(0);
    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeUndefined();
  });
});
