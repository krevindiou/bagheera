import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { readLastAttemptedEmail } from '../../composables/useLastAttemptedEmail';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import ForgotPasswordPage from './ForgotPasswordPage.vue';

const apiClient = asMockedApiClient(realApiClient);

describe('ForgotPasswordPage', () => {
  beforeEach(async () => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
    window.sessionStorage.clear();
    await router.push({ name: 'forgot-password' });
  });

  it('submits the address, remembers it, shows a toast, and returns to sign-in', async () => {
    const wrapper = mount(ForgotPasswordPage, withGlobalPlugins());
    await wrapper.find('#forgot-password-email').setValue('member@example.com');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/auth/password-recovery', {
      body: { email: 'member@example.com' },
    });
    expect(readLastAttemptedEmail()).toBe('member@example.com');
    expect(useToast().toasts[0]?.text).toBe(
      'If an account exists for this address, a password reset link has been sent.',
    );
    await waitForRouteName(router, 'sign-in');
  });

  it("shows a validation error and doesn't submit for an invalid email", async () => {
    const wrapper = mount(ForgotPasswordPage, withGlobalPlugins());
    await wrapper.find('#forgot-password-email').setValue('not-an-email');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
