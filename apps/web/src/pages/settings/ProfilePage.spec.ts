import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { queuedToastText } from '../../test-support/queuedToastText';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';
import ProfilePage from './ProfilePage.vue';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

function errorResult(status: number, error?: unknown) {
  return { data: undefined, error, response: new Response(null, { status }) };
}

type ApiResult = ReturnType<typeof jsonResult> | ReturnType<typeof errorResult>;

// ProfilePage reads session.member.email once, synchronously, as its form's
// initial value — the session needs to be populated on the *same* pinia
// instance before mount(), not after (see withGlobalPlugins' own doc-comment
// on why a fresh pinia is activated as soon as it's called).
function mountWithSession(email: string, attachTo?: Element) {
  const plugins = withGlobalPlugins();
  useSessionStore().setMember({ email, locale: 'en' });
  return mount(ProfilePage, { ...plugins, ...(attachTo ? { attachTo } : {}) });
}

/**
 * Routes step-up options/verify to success and defaults every other call
 * (i.e. `/members/profile`) to a plain 200 too — pass `profileResult` to
 * override that default for a test exercising a specific `/members/profile`
 * outcome.
 */
function mockSuccessfulStepUp(profileResult: ApiResult = jsonResult(200)) {
  apiClient.POST.mockImplementation(async (path: string) => {
    if (path === '/webauthn/step-up/options') return jsonResult(200, {});
    if (path === '/webauthn/step-up/verify') return jsonResult(200);
    if (path === '/members/profile') return profileResult;
    return jsonResult(404);
  });
  vi.mocked(startAuthentication).mockResolvedValue(
    {} as unknown as Awaited<ReturnType<typeof startAuthentication>>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    vi.mocked(startAuthentication).mockReset();
    useToast().toasts.splice(0);
  });

  it('prefills the email from the signed-in member', () => {
    const wrapper = mountWithSession('member@example.com');
    expect((wrapper.find('#profile-email').element as HTMLInputElement).value).toBe(
      'member@example.com',
    );
  });

  // Native `autofocus` only fires on a full page load; reached through a
  // client-side navigation, focus would stay on the link that was clicked.
  it('focuses the email field when the page mounts', () => {
    const wrapper = mountWithSession('member@example.com', document.body);

    expect(document.activeElement).toBe(wrapper.find('#profile-email').element);
    wrapper.unmount();
  });

  it('completes the step-up ceremony, then submits the change and shows a success toast', async () => {
    mockSuccessfulStepUp();
    const wrapper = mountWithSession('member@example.com');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/step-up/options');
    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/step-up/verify', {
      body: { response: {} },
    });
    expect(apiClient.POST).toHaveBeenCalledWith('/members/profile', {
      body: { email: 'member@example.com' },
    });
    expect(queuedToastText()).toContain(
      "If this email isn't already registered to another account",
    );
  });

  it('shows an error toast and never calls /members/profile when the step-up prompt is cancelled', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
    vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));

    const wrapper = mountWithSession('member@example.com');
    await submitAndSettle(wrapper);

    expect(queuedToastText()).toContain('Passkey confirmation failed');
    expect(apiClient.POST).not.toHaveBeenCalledWith('/members/profile', expect.anything() as never);
  });

  it('shows an error toast when step-up verification is rejected', async () => {
    apiClient.POST.mockImplementation(async (path: string) => {
      if (path === '/webauthn/step-up/options') return jsonResult(200, {});
      return jsonResult(401);
    });
    vi.mocked(startAuthentication).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startAuthentication>>,
    );

    const wrapper = mountWithSession('member@example.com');
    await submitAndSettle(wrapper);

    expect(queuedToastText()).toContain('Passkey confirmation failed');
  });

  it('shows a toast for any other /members/profile failure', async () => {
    mockSuccessfulStepUp(errorResult(400, { message: 'Email already taken' }));
    const wrapper = mountWithSession('member@example.com');
    await submitAndSettle(wrapper);

    expect(queuedToastText()).toContain('Email already taken');
  });

  it('falls back to a generic error toast when the update fails without a message', async () => {
    mockSuccessfulStepUp(jsonResult(500));
    const wrapper = mountWithSession('member@example.com');
    await submitAndSettle(wrapper);

    expect(queuedToastText()).toContain('Something went wrong. Please try again.');
  });

  it("shows a validation error and doesn't submit for an invalid email", async () => {
    const wrapper = mountWithSession('member@example.com');
    await wrapper.find('#profile-email').setValue('not-an-email');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Enter a valid email address.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
