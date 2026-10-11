import { effectScope, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { useThirdPartyAutocomplete } from './useThirdPartyAutocomplete';

const apiClient = asMockedApiClient(realApiClient);

// Runs the composable inside an effect scope, like a component's setup(),
// so its onScopeDispose cleanup can be exercised and scope.stop() tears it
// down between tests.
function setup(...args: Parameters<typeof useThirdPartyAutocomplete>) {
  const scope = effectScope();
  const result = scope.run(() => useThirdPartyAutocomplete(...args))!;
  return { ...result, scope };
}

describe('useThirdPartyAutocomplete', () => {
  const scopes: ReturnType<typeof effectScope>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue({ data: [], error: undefined, response: new Response() });
  });

  afterEach(() => {
    scopes.forEach((scope) => scope.stop());
    scopes.length = 0;
    vi.useRealTimers();
  });

  function mount(...args: Parameters<typeof useThirdPartyAutocomplete>) {
    const { scope, ...result } = setup(...args);
    scopes.push(scope);
    return result;
  }

  it("doesn't query below 2 characters", async () => {
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = mount(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'a';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(apiClient.GET).not.toHaveBeenCalled();
    expect(suggestions.value).toEqual([]);
  });

  it('queries 300ms after the field settles at 2+ characters', async () => {
    const thirdParty = ref<string | undefined>('');
    mount(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'Lan';
    await nextTick();
    await vi.advanceTimersByTimeAsync(299);
    expect(apiClient.GET).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(apiClient.GET).toHaveBeenCalledWith('/operations/autocomplete', {
      params: { query: { q: 'Lan', type: 'debit' } },
    });
  });

  it('resets the debounce on every keystroke, only querying once for the final value', async () => {
    const thirdParty = ref<string | undefined>('');
    mount(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'La';
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);

    thirdParty.value = 'Lan';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(apiClient.GET).toHaveBeenCalledTimes(1);
    expect(apiClient.GET).toHaveBeenCalledWith('/operations/autocomplete', {
      params: { query: { q: 'Lan', type: 'debit' } },
    });
  });

  it("reports an exact match's category back through onExactMatch", async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: [{ thirdParty: 'Landlord', categoryId: 'cat-1' }],
      error: undefined,
      response: new Response(),
    });
    const onExactMatch = vi.fn();
    const thirdParty = ref<string | undefined>('');
    mount(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'landlord';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(onExactMatch).toHaveBeenCalledWith('cat-1');
  });

  it("doesn't call onExactMatch when nothing matches exactly", async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: [{ thirdParty: 'Landlord Inc', categoryId: 'cat-1' }],
      error: undefined,
      response: new Response(),
    });
    const onExactMatch = vi.fn();
    const thirdParty = ref<string | undefined>('');
    mount(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'landlord';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(onExactMatch).not.toHaveBeenCalled();
  });

  it('ignores a stale response that resolves after a newer query', async () => {
    let resolveFirst: (value: {
      data: { thirdParty: string; categoryId: string | null }[];
      error: undefined;
      response: Response;
    }) => void;
    apiClient.GET.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    apiClient.GET.mockResolvedValueOnce({
      data: [{ thirdParty: 'Landlord Two', categoryId: 'cat-2' }],
      error: undefined,
      response: new Response(),
    });
    const onExactMatch = vi.fn();
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = mount(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'Landlord One';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    thirdParty.value = 'Landlord Two';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    // The second (newer) query's response lands first.
    expect(suggestions.value).toEqual([{ thirdParty: 'Landlord Two', categoryId: 'cat-2' }]);
    expect(onExactMatch).toHaveBeenCalledWith('cat-2');

    // The first (stale) query resolves afterwards and must be ignored.
    resolveFirst!({
      data: [{ thirdParty: 'Landlord One', categoryId: 'cat-1' }],
      error: undefined,
      response: new Response(),
    });
    await nextTick();

    expect(suggestions.value).toEqual([{ thirdParty: 'Landlord Two', categoryId: 'cat-2' }]);
    expect(onExactMatch).not.toHaveBeenCalledWith('cat-1');
    expect(onExactMatch).toHaveBeenCalledTimes(1);
  });

  it("doesn't throw when the fetch rejects", async () => {
    apiClient.GET.mockRejectedValueOnce(new Error('network error'));
    const onExactMatch = vi.fn();
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = mount(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'Landlord';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(suggestions.value).toEqual([]);
    expect(onExactMatch).not.toHaveBeenCalled();
  });

  it('clears suggestions once the field drops back under 2 characters', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: [{ thirdParty: 'Landlord', categoryId: null }],
      error: undefined,
      response: new Response(),
    });
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = mount(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'La';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    expect(suggestions.value).toHaveLength(1);

    thirdParty.value = 'L';
    await nextTick();
    expect(suggestions.value).toEqual([]);
  });

  it('cancels a pending query once the owning scope is disposed', async () => {
    const onExactMatch = vi.fn();
    const thirdParty = ref<string | undefined>('');
    const { scope } = setup(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'Landlord';
    await nextTick();
    scope.stop();
    await vi.advanceTimersByTimeAsync(300);

    expect(apiClient.GET).not.toHaveBeenCalled();
    expect(onExactMatch).not.toHaveBeenCalled();
  });
});
