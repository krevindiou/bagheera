import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn() }));

import { startRegistration } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import PasskeysPage from './PasskeysPage.vue';

const apiClient = asMockedApiClient(realApiClient);

interface PasskeySummary {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

function mockCredentials(credentials: PasskeySummary[]) {
  apiClient.GET.mockImplementation(async (path: string) => {
    if (path === '/webauthn/credentials') return jsonResult(200, credentials);
    return jsonResult(200, undefined);
  });
}

describe('PasskeysPage', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.DELETE.mockReset();
    vi.mocked(startRegistration).mockReset();
    mockCredentials([]);
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('shows the empty-state message when there are no passkeys', async () => {
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();
    expect(wrapper.text()).toContain("You don't have any passkey yet.");
  });

  it('lists passkeys, falling back for an unnamed device and a never-used one', async () => {
    mockCredentials([
      { id: 'p1', deviceName: 'MacBook', createdAt: '2026-01-01', lastUsedAt: '2026-01-15' },
      { id: 'p2', deviceName: null, createdAt: '2026-01-02', lastUsedAt: null },
    ]);
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('MacBook');
    expect(rows[0].text()).toContain('1/15/2026');
    expect(rows[1].text()).toContain('Unnamed passkey');
    expect(rows[1].text()).toContain('Never');
  });

  it('registers a passkey end to end and reloads the list', async () => {
    apiClient.POST.mockImplementation(async (path: string) => {
      if (path === '/webauthn/registration/options') return jsonResult(200, {});
      if (path === '/webauthn/registration/verify') return jsonResult(200);
      return jsonResult(404);
    });
    vi.mocked(startRegistration).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startRegistration>>,
    );
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('#passkey-device-name').setValue('MacBook');
    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/webauthn/registration/verify', {
      body: { response: {}, deviceName: 'MacBook' },
    });
    expect(useToast().toasts[0]?.text).toBe('Passkey added');
    expect((wrapper.find('#passkey-device-name').element as HTMLInputElement).value).toBe('');
  });

  it('shows an error and never prompts for a passkey when registration options fail', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(startRegistration).not.toHaveBeenCalled();
    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('silently abandons a cancelled passkey prompt', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, {}));
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'));
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledTimes(1);
    expect(useToast().toasts).toHaveLength(0);
  });

  it('shows an error when verification fails', async () => {
    apiClient.POST.mockImplementation(async (path: string) => {
      if (path === '/webauthn/registration/options') return jsonResult(200, {});
      if (path === '/webauthn/registration/verify') return jsonResult(400);
      return jsonResult(404);
    });
    vi.mocked(startRegistration).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof startRegistration>>,
    );
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('removes a passkey once confirmed', async () => {
    mockCredentials([
      { id: 'p1', deviceName: 'MacBook', createdAt: '2026-01-01', lastUsedAt: null },
    ]);
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/webauthn/credentials/{id}', {
      params: { path: { id: 'p1' } },
    });
    expect(useToast().toasts[0]?.text).toBe('Passkey removed');
  });

  it('shows an error toast when removing a passkey fails', async () => {
    mockCredentials([
      { id: 'p1', deviceName: 'MacBook', createdAt: '2026-01-01', lastUsedAt: null },
    ]);
    apiClient.DELETE.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('shows the specific last-passkey error, not the generic toast, on a 400', async () => {
    mockCredentials([
      { id: 'p1', deviceName: 'Only one', createdAt: '2026-01-01', lastUsedAt: null },
    ]);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Cannot remove your last passkey — it would lock you out permanently.' },
      response: new Response(null, { status: 400 }),
    });
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(useToast().toasts[0]?.text).toBe(
      "This is your last passkey — you can't remove it, or you'd be permanently locked out.",
    );
  });

  it("doesn't remove a passkey when the confirmation is cancelled", async () => {
    mockCredentials([
      { id: 'p1', deviceName: 'MacBook', createdAt: '2026-01-01', lastUsedAt: null },
    ]);
    const wrapper = mount(PasskeysPage, withGlobalPlugins());
    await flushPromises();

    await wrapper.find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });
});
