import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';
import ProfilePage from './ProfilePage.vue';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, error?: unknown) {
  return { data: undefined, error, response: new Response(null, { status }) };
}

// ProfilePage reads session.member.email once, synchronously, as its form's
// initial value — the session needs to be populated on the *same* pinia
// instance before mount(), not after (see withGlobalPlugins' own doc-comment
// on why a fresh pinia is activated as soon as it's called).
function mountWithSession(email: string) {
  const plugins = withGlobalPlugins();
  useSessionStore().setMember({ email });
  return mount(ProfilePage, plugins);
}

describe('ProfilePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it('prefills the email from the signed-in member', () => {
    const wrapper = mountWithSession('member@example.com');
    expect((wrapper.find('#profile-email').element as HTMLInputElement).value).toBe(
      'member@example.com',
    );
  });

  it('submits the change, clears the password field, and shows a success toast', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-current-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/members/profile', {
      body: { email: 'member@example.com', currentPassword: 'hunter2' },
    });
    expect((wrapper.find('#profile-current-password').element as HTMLInputElement).value).toBe('');
    expect(wrapper.text()).toContain("If this email isn't already registered to another account");
  });

  it('shows an inline field error (not a toast) for an invalid current password', async () => {
    apiClient.POST.mockResolvedValueOnce(
      jsonResult(422, { message: 'Current password is invalid.' }),
    );
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-current-password').setValue('wrong');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Current password is invalid.');
    expect(useToast().toasts).toHaveLength(0);

    // PasswordInput wraps its <input> in its own .input-group, so its
    // sibling .invalid-feedback needs d-block — Bootstrap's plain
    // .is-invalid ~ .invalid-feedback rule never matches across that
    // extra nesting level. wrapper.text() above would pass either way.
    const currentPasswordError = wrapper
      .findAll('.invalid-feedback')
      .find((el) => el.text() === 'Current password is invalid.');
    expect(currentPasswordError?.classes()).toContain('d-block');
  });

  it('shows a toast for any other failure', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400, { message: 'Email already taken' }));
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-current-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Email already taken');
  });

  it('falls back to a generic error toast when the update fails without a message', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-current-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it("shows a validation error and doesn't submit for an invalid email", async () => {
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-email').setValue('not-an-email');
    await wrapper.find('#profile-current-password').setValue('hunter2');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
