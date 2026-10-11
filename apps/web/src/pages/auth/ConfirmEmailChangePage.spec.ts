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

const member = { email: 'new@example.com', locale: 'en', timeZone: 'UTC' };

function signedIn() {
  apiClient.GET.mockResolvedValue({
    data: member,
    error: undefined,
    response: new Response(null, { status: 200 }),
  });
}

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    // Signed out: the session probe finds no member.
    apiClient.GET.mockReset().mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 401 }),
    });
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

  it('shows an error toast and still redirects when the request itself fails', async () => {
    apiClient.POST.mockRejectedValueOnce(new Error('network failure'));
    await router.push({ name: 'confirm-email-change', query: { key: 'abc123' } });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('Email change error (link expired or already used?)');
  });

  it('keeps a signed-in member in the app, with their new address, on a valid key', async () => {
    signedIn();
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'confirm-email-change', query: { key: 'abc123' } });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'home');

    expect(useToast().toasts[0]?.text).toBe('Your email address has been updated.');
    await vi.waitFor(() => {
      expect(
        apiClient.GET.mock.calls.filter(([path]) => path === '/auth/me').length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it('sends a signed-in member home with an error toast when the link has no key', async () => {
    signedIn();
    await router.push({ name: 'confirm-email-change' });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'home');

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('Email change error (link expired or already used?)');
  });

  it('falls back to sign-in when the session probe itself fails', async () => {
    apiClient.GET.mockRejectedValue(new Error('network failure'));
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'confirm-email-change', query: { key: 'abc123' } });
    mount(ConfirmEmailChangePage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(useToast().toasts[0]?.text).toBe('Your email address has been updated.');
  });
});
