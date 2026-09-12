import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '../router';
import { useSessionStore } from '../stores/session.store';
// This module *is* what `mockApiClient()` stands in for everywhere else —
// tested directly here: mock the network one layer below it, and exercise
// the real client (real middlewares, real router, real session store)
// against that.
import { apiClient } from './client';

// Node's fetch/Request implementation (unlike a browser) has no ambient
// document to resolve a relative URL against, so every call below passes an
// absolute `baseUrl` override — openapi-fetch supports this per-call,
// independently of the "/" baseUrl the app itself configures in production.
const TEST_BASE_URL = 'http://localhost:3000';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push({ name: 'register' });

    // Explicit generic: inferring it from the callback alone collapses to
    // vitest's generic `Procedure | Constructable` mock type, which doesn't
    // structurally match the `(input: Request) => Promise<Response>` shape
    // openapi-fetch's per-call `fetch` option expects (see below).
    fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) =>
      urlOf(input).includes('csrf-token')
        ? jsonResponse(200, { csrfToken: 'test-csrf-token' })
        : jsonResponse(200, {}),
    );
    // Covers the CSRF pre-flight call, which always reads the live global
    // directly. The client's own request goes through the `fetch` override
    // passed to each call below instead (see TEST_BASE_URL comment).
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('CSRF header', () => {
    it("doesn't fetch a CSRF token for a safe (GET) request", async () => {
      await apiClient.GET('/auth/me', { baseUrl: TEST_BASE_URL, fetch: fetchMock });
      const urls = fetchMock.mock.calls.map(([input]) => urlOf(input));
      expect(urls.some((u) => u.includes('csrf-token'))).toBe(false);
    });

    it('fetches a fresh CSRF token and attaches it to a mutating (POST) request', async () => {
      await apiClient.POST('/auth/sign-out', { baseUrl: TEST_BASE_URL, fetch: fetchMock });

      const csrfCall = fetchMock.mock.calls.find(([input]) => urlOf(input).includes('csrf-token'));
      expect(csrfCall).toBeDefined();

      const realCall = fetchMock.mock.calls.find(([input]) => !urlOf(input).includes('csrf-token'));
      const realRequest = realCall?.[0] as Request;
      expect(realRequest.headers.get('x-csrf-token')).toBe('test-csrf-token');
    });
  });

  describe('401 handling', () => {
    it('clears the session and redirects to sign-in on a 401', async () => {
      useSessionStore().setMember({ email: 'member@example.com' });
      fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
        urlOf(input).includes('csrf-token')
          ? jsonResponse(200, { csrfToken: 'test-csrf-token' })
          : jsonResponse(401),
      );
      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);

      await apiClient.GET('/auth/me', { baseUrl: TEST_BASE_URL, fetch: fetchMock });

      expect(useSessionStore().member).toBeNull();
      expect(pushSpy).toHaveBeenCalledWith({ name: 'sign-in' });
    });

    it("doesn't redirect again when already on sign-in", async () => {
      await router.push({ name: 'sign-in' });
      fetchMock.mockImplementation(async () => jsonResponse(401));
      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);

      await apiClient.GET('/auth/me', { baseUrl: TEST_BASE_URL, fetch: fetchMock });

      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('leaves the session and route alone on a non-401 response', async () => {
      useSessionStore().setMember({ email: 'member@example.com' });
      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);

      await apiClient.GET('/auth/me', { baseUrl: TEST_BASE_URL, fetch: fetchMock });

      expect(useSessionStore().member).toEqual({ email: 'member@example.com' });
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it("doesn't throw when a 401 arrives with no active Pinia instance", async () => {
      setActivePinia(undefined);
      fetchMock.mockImplementation(async () => jsonResponse(401));

      const result = await apiClient.GET('/auth/me', { baseUrl: TEST_BASE_URL, fetch: fetchMock });

      expect(result.response.status).toBe(401);
    });
  });
});
