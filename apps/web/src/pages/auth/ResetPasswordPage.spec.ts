import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { waitForRouteName } from '../../test-support/waitForRouteName';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { router } from '../../router';
import ResetPasswordPage from './ResetPasswordPage.vue';

const apiClient = asMockedApiClient(realApiClient);

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it('redirects to sign-in immediately when the link has no key', async () => {
    await router.push({ name: 'reset-password' });
    mount(ResetPasswordPage, withGlobalPlugins());
    await waitForRouteName(router, 'sign-in');

    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('resets the password and redirects to sign-in on success', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'reset-password', query: { key: 'abc123' } });
    const wrapper = mount(ResetPasswordPage, withGlobalPlugins());
    await wrapper.find('#reset-password-password').setValue('longenough1');
    await wrapper.find('#reset-password-password-confirmation').setValue('longenough1');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/auth/password-recovery/reset', {
      body: { key: 'abc123', password: 'longenough1', passwordConfirmation: 'longenough1' },
    });
    expect(useToast().toasts[0]?.text).toBe('Your password has been updated.');
    await waitForRouteName(router, 'sign-in');
  });

  it('redirects to sign-in without a toast when the key is rejected', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 400 }),
    });
    await router.push({ name: 'reset-password', query: { key: 'expired' } });
    const wrapper = mount(ResetPasswordPage, withGlobalPlugins());
    await wrapper.find('#reset-password-password').setValue('longenough1');
    await wrapper.find('#reset-password-password-confirmation').setValue('longenough1');
    await submitAndSettle(wrapper);

    await waitForRouteName(router, 'sign-in');
    expect(useToast().toasts).toHaveLength(0);
  });

  it("shows a validation error and doesn't submit for a too-short password", async () => {
    await router.push({ name: 'reset-password', query: { key: 'abc123' } });
    const wrapper = mount(ResetPasswordPage, withGlobalPlugins());
    await wrapper.find('#reset-password-password').setValue('short1');
    await wrapper.find('#reset-password-password-confirmation').setValue('short1');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Password must be at least 8 characters.');
    expect(apiClient.POST).not.toHaveBeenCalled();

    // PasswordInput wraps its <input> in its own .input-group, so its
    // sibling .invalid-feedback needs d-block — Bootstrap's plain
    // .is-invalid ~ .invalid-feedback rule never matches across that
    // extra nesting level. wrapper.text() above would pass either way.
    const passwordError = wrapper
      .findAll('.invalid-feedback')
      .find((el) => el.text() === 'Password must be at least 8 characters.');
    expect(passwordError?.classes()).toContain('d-block');
  });

  it("shows a validation error and doesn't submit for mismatched passwords", async () => {
    await router.push({ name: 'reset-password', query: { key: 'abc123' } });
    const wrapper = mount(ResetPasswordPage, withGlobalPlugins());
    await wrapper.find('#reset-password-password').setValue('longenough1');
    await wrapper.find('#reset-password-password-confirmation').setValue('different1');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Passwords don't match.");
    expect(apiClient.POST).not.toHaveBeenCalled();

    const confirmationError = wrapper
      .findAll('.invalid-feedback')
      .find((el) => el.text() === "Passwords don't match.");
    expect(confirmationError?.classes()).toContain('d-block');
  });

  it('rejects an 8+ char password made of only one character class, with a distinct message', async () => {
    await router.push({ name: 'reset-password', query: { key: 'abc123' } });
    const wrapper = mount(ResetPasswordPage, withGlobalPlugins());
    await wrapper.find('#reset-password-password').setValue('alllowercase');
    await wrapper.find('#reset-password-password-confirmation').setValue('alllowercase');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain(
      'Use a mix of at least 2 of: lowercase, uppercase, numbers, symbols.',
    );
    expect(wrapper.text()).not.toContain('Password must be at least 8 characters.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
