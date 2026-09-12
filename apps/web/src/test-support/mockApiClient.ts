import { vi } from 'vitest';

/**
 * Stand-in for the `apiClient` singleton (openapi-fetch): every HTTP method
 * is a `vi.fn()` defaulting to an empty 200 response. Called from *inside*
 * a `vi.mock` factory (never hoisted via `vi.hoisted` — that runs before
 * this module's own import is linked, so calling it there throws) so each
 * spec's mocked client is a fresh instance:
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
 * Re-types an `apiClient` import that's actually the `mockApiClient()`
 * installed above via `vi.mock` — openapi-fetch's real client type is a
 * generic, path-keyed union that a plain mocked resolved value can't
 * usefully satisfy, so `vi.mocked()` alone doesn't help here.
 */
export function asMockedApiClient(client: unknown): MockedApiClient {
  return client as MockedApiClient;
}
