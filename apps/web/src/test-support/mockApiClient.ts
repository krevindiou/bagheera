import { vi } from 'vitest';

/**
 * Stand-in for `apiClient`: every method a `vi.fn()` resolving to an empty
 * 200. Call it inside the `vi.mock` factory (`vi.hoisted` runs before this
 * import is linked):
 *
 *   vi.mock("../../api/client", () => ({ apiClient: mockApiClient() }));
 *   import { apiClient as realApiClient } from "../../api/client";
 *   const apiClient = asMockedApiClient(realApiClient);
 *   // ...
 *   apiClient.GET.mockResolvedValueOnce({ data, error: undefined, response });
 */
export function mockApiClient() {
  const okResponse = () => new Response(null, { status: 200 });
  const defaultResult = { data: undefined, error: undefined, response: okResponse() };
  return {
    GET: vi.fn().mockResolvedValue(defaultResult),
    POST: vi.fn().mockResolvedValue(defaultResult),
    PUT: vi.fn().mockResolvedValue(defaultResult),
    PATCH: vi.fn().mockResolvedValue(defaultResult),
    DELETE: vi.fn().mockResolvedValue(defaultResult),
  };
}

export type MockedApiClient = ReturnType<typeof mockApiClient>;

/**
 * Re-types the mocked `apiClient` import: openapi-fetch's path-keyed
 * generic type defeats `vi.mocked()`.
 */
export function asMockedApiClient(client: unknown): MockedApiClient {
  return client as MockedApiClient;
}
