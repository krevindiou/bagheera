import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { setLocale } from '../../i18n';
import SessionsPage from './SessionsPage.vue';

const apiClient = asMockedApiClient(realApiClient);

interface SessionSummary {
  id: string;
  current: boolean;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
}

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

const CURRENT: SessionSummary = {
  id: 'a'.repeat(32),
  current: true,
  browser: 'Firefox',
  os: 'Linux',
  ipAddress: '198.51.100.1',
  signedInAt: '2026-11-10T08:00:00Z',
  lastActiveAt: '2026-11-10T09:00:00Z',
};

const OTHER: SessionSummary = {
  id: 'b'.repeat(32),
  current: false,
  browser: null,
  os: 'iOS',
  ipAddress: null,
  signedInAt: '2026-11-09T08:00:00Z',
  lastActiveAt: '2026-11-09T08:30:00Z',
};

function mockSessions(sessions: SessionSummary[]) {
  apiClient.GET.mockImplementation(async (path: string) => {
    if (path === '/auth/sessions') return jsonResult(200, sessions);
    return jsonResult(200, undefined);
  });
}

// Step-up options/verify succeed; the assertion comes from the
// `startAuthentication` default in beforeEach.
function mockStepUp() {
  apiClient.POST.mockImplementation(async (path: string) => {
    if (path === '/webauthn/step-up/options') return jsonResult(200, {});
    if (path === '/webauthn/step-up/verify') return jsonResult(200);
    return jsonResult(404);
  });
}

async function mountPage(sessions: SessionSummary[] = [CURRENT, OTHER]) {
  mockSessions(sessions);
  const wrapper = mount(SessionsPage, withGlobalPlugins());
  await flushPromises();
  return wrapper;
}

async function clickAndConfirm(wrapper: Awaited<ReturnType<typeof mountPage>>, selector: string) {
  await wrapper.find(selector).trigger('click');
  useConfirm().settle(true);
  await flushPromises();
}

const ROW_SIGN_OUT = `[data-testid="session-${OTHER.id}"] button`;

describe('SessionsPage', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.DELETE.mockReset();
    vi.mocked(startAuthentication)
      .mockReset()
      .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof startAuthentication>>);
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  afterEach(async () => {
    await setLocale('en');
  });

  it('lists each session with its device, address and times, marking this one', async () => {
    const wrapper = await mountPage();

    const current = wrapper.find(`[data-testid="session-${CURRENT.id}"]`);
    expect(current.text()).toContain('Firefox on Linux');
    expect(current.text()).toContain('This device');
    expect(current.text()).toContain('198.51.100.1');
    expect(current.text()).toContain('Now');
    expect(current.find('button').exists()).toBe(false);

    const other = wrapper.find(`[data-testid="session-${OTHER.id}"]`);
    expect(other.text()).toContain('Unknown browser on iOS');
    expect(other.text()).toContain('Unknown');
    expect(other.text()).not.toContain('This device');
  });

  it('says so when neither the browser nor the system is known', async () => {
    const wrapper = await mountPage([CURRENT, { ...OTHER, os: null }]);

    expect(wrapper.find(`[data-testid="session-${OTHER.id}"]`).text()).toContain(
      'Unknown browser on unknown system',
    );
  });

  it('shows an error message when the list fails to load', async () => {
    apiClient.GET.mockResolvedValue({
      data: undefined,
      error: { message: 'Internal error' },
      response: new Response(null, { status: 500 }),
    });
    const wrapper = mount(SessionsPage, withGlobalPlugins());
    await flushPromises();
    expect(wrapper.find('[data-testid="sessions-error"]').exists()).toBe(true);
  });

  it('offers no sign-out when this is the only session', async () => {
    const wrapper = await mountPage([CURRENT]);

    expect(wrapper.find('[data-testid="sign-out-others"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No other browser is signed in.');
  });

  it('names the session in a danger confirmation', async () => {
    const wrapper = await mountPage();

    await wrapper.find(ROW_SIGN_OUT).trigger('click');

    expect(useConfirm().state.options).toEqual({
      body: 'Sign out “Unknown browser on iOS”? It will have to sign in with a passkey again.',
      confirmLabel: 'Sign out',
      danger: true,
    });
  });

  it('steps up, then signs out that session once confirmed', async () => {
    mockStepUp();
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(200));
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, ROW_SIGN_OUT);

    expect(apiClient.POST.mock.calls.map((call) => call[0])).toEqual([
      '/webauthn/step-up/options',
      '/webauthn/step-up/verify',
    ]);
    expect(apiClient.DELETE).toHaveBeenCalledWith('/auth/sessions/{id}', {
      params: { path: { id: OTHER.id } },
    });
    expect(useToast().toasts[0]?.text).toBe('Session signed out');
  });

  it('asks for no passkey when the confirmation is cancelled', async () => {
    const wrapper = await mountPage();

    await wrapper.find(ROW_SIGN_OUT).trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });

  it('shows the step-up error and never signs out when step-up fails', async () => {
    mockStepUp();
    vi.mocked(startAuthentication).mockRejectedValueOnce(
      new DOMException('cancelled', 'NotAllowedError'),
    );
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, ROW_SIGN_OUT);

    expect(apiClient.DELETE).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('Passkey confirmation failed. Please try again.');
  });

  it('treats a session that already ended as signed out', async () => {
    mockStepUp();
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(404));
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, ROW_SIGN_OUT);

    expect(useToast().toasts[0]?.text).toBe('Session signed out');
  });

  it('shows an error toast when signing out a session fails', async () => {
    mockStepUp();
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(500));
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, ROW_SIGN_OUT);

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('steps up, then signs out every other session once confirmed', async () => {
    mockStepUp();
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(200));
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, '[data-testid="sign-out-others"]');

    expect(apiClient.DELETE).toHaveBeenCalledWith('/auth/sessions');
    expect(useToast().toasts[0]?.text).toBe('Other sessions signed out');
  });

  it('asks for no passkey when signing out the other sessions is cancelled', async () => {
    const wrapper = await mountPage();

    await wrapper.find('[data-testid="sign-out-others"]').trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });

  it('shows an error toast when signing out the other sessions fails', async () => {
    mockStepUp();
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(500));
    const wrapper = await mountPage();

    await clickAndConfirm(wrapper, '[data-testid="sign-out-others"]');

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });
});
