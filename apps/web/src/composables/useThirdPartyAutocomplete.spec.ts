import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { useThirdPartyAutocomplete } from './useThirdPartyAutocomplete';

const apiClient = asMockedApiClient(realApiClient);

describe('useThirdPartyAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue({ data: [], error: undefined, response: new Response() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't query below 2 characters", async () => {
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = useThirdPartyAutocomplete(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'a';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(apiClient.GET).not.toHaveBeenCalled();
    expect(suggestions.value).toEqual([]);
  });

  it('queries 300ms after the field settles at 2+ characters', async () => {
    const thirdParty = ref<string | undefined>('');
    useThirdPartyAutocomplete(thirdParty, ref('debit'), vi.fn());

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
    useThirdPartyAutocomplete(thirdParty, ref('debit'), vi.fn());

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
    useThirdPartyAutocomplete(thirdParty, ref('debit'), onExactMatch);

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
    useThirdPartyAutocomplete(thirdParty, ref('debit'), onExactMatch);

    thirdParty.value = 'landlord';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);

    expect(onExactMatch).not.toHaveBeenCalled();
  });

  it('clears suggestions once the field drops back under 2 characters', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: [{ thirdParty: 'Landlord', categoryId: null }],
      error: undefined,
      response: new Response(),
    });
    const thirdParty = ref<string | undefined>('');
    const { suggestions } = useThirdPartyAutocomplete(thirdParty, ref('debit'), vi.fn());

    thirdParty.value = 'La';
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    expect(suggestions.value).toHaveLength(1);

    thirdParty.value = 'L';
    await nextTick();
    expect(suggestions.value).toEqual([]);
  });
});
