import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import ConfirmEmailChangePage from './ConfirmEmailChangePage.vue';

const apiClient = asMockedApiClient(realApiClient);

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it('redirects to sign-in with an error toast when the link has no key', async () => {
    await router.push({ name: 'confirm-email-change' });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('Email change error (link expired or already used?)');
  });

  it('confirms the email change and redirects to sign-in on a valid key', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'confirm-email-change', query: { key: 'abc123' } });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).toHaveBeenCalledWith('/members/profile/confirm-email-change', {
      body: { key: 'abc123' },
    });
    expect(useToast().toasts[0]?.text).toBe('Your email address has been updated.');
  });

  it('shows an error toast and still redirects when the key is rejected', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 400 }),
    });
    await router.push({ name: 'confirm-email-change', query: { key: 'expired' } });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('Email change error (link expired or already used?)');
  });
});
