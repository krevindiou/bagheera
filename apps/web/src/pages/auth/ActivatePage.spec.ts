import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn() }));

import { startRegistration } from '@simplewebauthn/browser';
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
    vi.mocked(startRegistration).mockReset();
    useToast().toasts.splice(0);
  });

  it('redirects to sign-in with an error toast when the link has no key', async () => {
    await router.push({ name: 'activate' });
    mount(ActivatePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('This link is invalid or has expired.');
  });

  it('shows a Continue button instead of auto-running the ceremony — it needs a real user gesture', async () => {
    // navigator.credentials.create() requires a genuine user gesture in
    // real browsers — an onMounted auto-attempt is silently blocked, so
    // this page must wait for a click instead (see ActivatePage.vue's own
    // comment).
    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.find('button').exists()).toBe(true);
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
    await wrapper.find('button').trigger('click');
    await waitForRouteName(router, 'home');

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/signup/options', {
      body: { key: 'abc123' },
    });
    expect(useSessionStore().isAuthenticated).toBe(true);
    expect(useToast().toasts[0]?.text).toBe('Account created. You are now signed in.');
  });

  it('shows an error toast and redirects to sign-in when the key is rejected', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    await router.push({ name: 'activate', query: { key: 'expired' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button').trigger('click');
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('This link is invalid or has expired.');
  });

  it('shows an error toast and redirects to sign-in when the passkey prompt is cancelled', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'));

    await router.push({ name: 'activate', query: { key: 'abc123' } });
    const wrapper = mount(ActivatePage, withGlobalPlugins());
    await wrapper.vm.$nextTick();
    await wrapper.find('button').trigger('click');
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('This link is invalid or has expired.');
  });
});
