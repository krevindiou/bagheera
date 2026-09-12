import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import ActivatePage from './ActivatePage.vue';

const apiClient = asMockedApiClient(realApiClient);

describe('ActivatePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it('redirects to sign-in with an error toast when the link has no key', async () => {
    await router.push({ name: 'activate' });
    mount(ActivatePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('Activation error (Already activated?)');
  });

  it('activates the account and redirects to sign-in on a valid key', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'activate', query: { key: 'abc123' } });
    mount(ActivatePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).toHaveBeenCalledWith('/members/activate', { body: { key: 'abc123' } });
    expect(useToast().toasts[0]?.text).toBe('Account activated. You can now sign in.');
  });

  it('shows an error toast and still redirects when the key is rejected', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 400 }),
    });
    await router.push({ name: 'activate', query: { key: 'expired' } });
    mount(ActivatePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('Activation error (Already activated?)');
  });
});
