import createClient from 'openapi-fetch';
import { router } from '../router';
import { useSessionStore } from '../stores/session.store';
import type { paths } from './schema';

// Same-origin: kamal-proxy routes /api to the API in production, Vite's dev
// proxy locally. schema.d.ts paths leave out the API's /api prefix (Swagger
// ignores it), so it's added back here.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = createClient<paths>({
  baseUrl,
  credentials: 'include',
});

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The minted token, or the mint's own failed response (e.g. a 429 once its
// rate limit is hit), which the caller should see instead of its request.
async function fetchCsrfToken(): Promise<string | Response> {
  const res = await fetch(new URL(`${baseUrl}/auth/csrf-token`, window.location.origin), {
    credentials: 'include',
  });
  if (!res.ok) return res;
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

// The CSRF cookie is httpOnly, so every mutating request mints a fresh
// token first and sends it in the CSRF header: one extra round trip, but
// always right across session rotations.
apiClient.use({
  async onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) return request;
    const token = await fetchCsrfToken();
    // A failed mint answers for the request, so the caller sees its real
    // status rather than a CSRF 403. openapi-fetch then skips the fetch and
    // onResponse below.
    if (token instanceof Response) return token;
    const withCsrf = new Request(request);
    withCsrf.headers.set(CSRF_HEADER, token);
    return withCsrf;
  },
});

// A 401 means "no active session". A failed sign-in ceremony is a 401 too,
// but fires on the sign-in page, where the redirect is a no-op.
apiClient.use({
  onResponse({ response }) {
    if (response.status !== 401) return response;

    try {
      useSessionStore().clear();
    } catch {
      // No active Pinia: nothing to clear.
    }
    if (router.currentRoute.value.name !== 'sign-in') {
      void router.push({ name: 'sign-in' });
    }
    return response;
  },
});
