import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { queryKeys } from '../api/queryKeys';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { queuedToastText } from '../test-support/queuedToastText';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { useOperationSearch } from './useOperationSearch';

const apiClient = asMockedApiClient(realApiClient);

function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/operations', name: 'operations', component: stub }],
  });
}

const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
const page = (overrides: Record<string, unknown> = {}) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  active: false,
  criteria: {},
  ...overrides,
});
const ACTIVE = page({ active: true, criteria: { thirdParty: 'Foo' } });

// Runs the composable inside a mounted component, since useQuery needs the
// app's QueryClient (returned too, for cache-level assertions) and the
// page/query sync needs a real route.
async function run(accountId = ref('acc-1'), router: Router = createTestRouter()) {
  if (router.currentRoute.value.name === undefined) {
    await router.push({ name: 'operations' });
  }
  let result!: ReturnType<typeof useOperationSearch>;
  const { global, queryClient } = withGlobalPlugins(router);
  mount(
    defineComponent({
      setup() {
        result = useOperationSearch(accountId);
        return () => h('div');
      },
    }),
    { global },
  );
  return { search: result, accountId, queryClient, router };
}

describe('useOperationSearch', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.DELETE.mockReset();
  });

  it("lists the account's page through GET /operations, closed and inactive with no remembered search", async () => {
    apiClient.GET.mockResolvedValue(ok(page({ total: 3 })));
    const { search } = await run();
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: 'acc-1', page: 1 } },
    });
    expect(search.list.value.total).toBe(3);
    expect(search.isActive.value).toBe(false);
    expect(search.panelOpen.value).toBe(false);
  });

  it('restores a remembered search once: hydrated but closed on load, never reopened by a later refetch', async () => {
    apiClient.GET.mockResolvedValue(ok(ACTIVE));
    const { search, queryClient } = await run();
    await flushPromises();

    expect(search.isActive.value).toBe(true);
    expect(search.panelOpen.value).toBe(false);
    expect(search.criteria.value).toEqual({ thirdParty: 'Foo' });

    await queryClient.invalidateQueries({ queryKey: queryKeys.operations.all('acc-1') });
    await flushPromises();
    expect(search.panelOpen.value).toBe(false);

    search.page.value = 2;
    await flushPromises();
    expect(search.panelOpen.value).toBe(false);
    expect(search.isActive.value).toBe(true);
  });

  it('runs a search: closes the panel and marks the first page as the active search, without the restore reopening it', async () => {
    // Like the server: once a search is set, GET /operations re-applies it.
    let remembered: Record<string, unknown> | null = null;
    apiClient.GET.mockImplementation(async () =>
      ok(remembered ? page({ total: 1, active: true, criteria: remembered }) : page()),
    );
    apiClient.POST.mockImplementationOnce(async (_path: string, { body }: { body: object }) => {
      remembered = { ...body };
      delete remembered.accountId;
      return ok(page({ total: 1 }));
    });
    const { search } = await run();
    await flushPromises();
    search.page.value = 2;
    await flushPromises();
    search.openPanel();

    search.run({ thirdParty: 'Landlord' });
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/operations/search', {
      params: { query: { page: 1 } },
      body: { accountId: 'acc-1', thirdParty: 'Landlord' },
    });
    expect(search.page.value).toBe(1);
    expect(search.panelOpen.value).toBe(false);
    expect(search.isActive.value).toBe(true);
    expect(search.list.value.total).toBe(1);
    expect(search.criteria.value).toEqual({ thirdParty: 'Landlord' });
  });

  it('toasts a failed search and leaves the panel open', async () => {
    apiClient.GET.mockResolvedValue(ok(page()));
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: new Response(null, { status: 500 }),
    });
    const { search } = await run();
    await flushPromises();
    search.openPanel();

    search.run({ thirdParty: 'Landlord' });
    await flushPromises();

    expect(queuedToastText()).toContain("Couldn't load this. Please try again.");
    expect(search.panelOpen.value).toBe(true);
  });

  it('clears the remembered search: DELETE, panel closed, back to page 1 and refetched unfiltered', async () => {
    apiClient.GET.mockResolvedValueOnce(ok(ACTIVE)).mockResolvedValue(ok(page()));
    apiClient.DELETE.mockResolvedValueOnce(ok(undefined));
    const { search } = await run();
    await flushPromises();
    expect(search.isActive.value).toBe(true);

    search.clear();
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: 'acc-1' } },
    });
    expect(search.panelOpen.value).toBe(false);
    expect(search.page.value).toBe(1);
    expect(search.isActive.value).toBe(false);
  });

  it('toasts a failed clear and leaves the remembered search active', async () => {
    apiClient.GET.mockResolvedValue(ok(ACTIVE));
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: new Response(null, { status: 500 }),
    });
    const { search } = await run();
    await flushPromises();
    search.closePanel();

    search.clear();
    await flushPromises();

    expect(queuedToastText()).toContain("Couldn't load this. Please try again.");
    expect(search.panelOpen.value).toBe(false);
    expect(search.isActive.value).toBe(true);
  });

  it("switching account resets the page and panel, then restores the new account's own search", async () => {
    apiClient.GET.mockResolvedValue(ok(page()));
    const { search, accountId } = await run();
    await flushPromises();
    search.page.value = 3;
    search.openPanel();
    await flushPromises();

    apiClient.GET.mockResolvedValue(ok(page({ active: true, criteria: { thirdParty: 'Bar' } })));
    accountId.value = 'acc-2';
    await flushPromises();

    expect(search.page.value).toBe(1);
    expect(apiClient.GET).toHaveBeenLastCalledWith('/operations', {
      params: { query: { accountId: 'acc-2', page: 1 } },
    });
    expect(search.panelOpen.value).toBe(false);
    expect(search.criteria.value).toEqual({ thirdParty: 'Bar' });
  });

  it('starts from the ?page= query param', async () => {
    apiClient.GET.mockResolvedValue(ok(page()));
    const router = createTestRouter();
    await router.push({ name: 'operations', query: { page: '3' } });
    const { search } = await run(ref('acc-1'), router);
    await flushPromises();

    expect(search.page.value).toBe(3);
    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: 'acc-1', page: 3 } },
    });
  });

  it.each([['0'], ['-1'], ['abc'], [''], [undefined]])(
    'normalizes an invalid ?page=%s to page 1',
    async (raw) => {
      apiClient.GET.mockResolvedValue(ok(page()));
      const router = createTestRouter();
      await router.push({ name: 'operations', query: raw === undefined ? {} : { page: raw } });
      const { search } = await run(ref('acc-1'), router);
      await flushPromises();

      expect(search.page.value).toBe(1);
    },
  );

  it('writes the page to the URL via router.replace, omitting the param for page 1', async () => {
    apiClient.GET.mockResolvedValue(ok(page()));
    const router = createTestRouter();
    const replaceSpy = vi.spyOn(router, 'replace');
    const { search } = await run(ref('acc-1'), router);
    await flushPromises();

    search.page.value = 2;
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBe('2');
    expect(replaceSpy).toHaveBeenCalled();

    search.page.value = 1;
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBeUndefined();
  });
});
