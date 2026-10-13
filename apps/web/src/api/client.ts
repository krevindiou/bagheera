import createClient from 'openapi-fetch';
import { useToast } from '../composables/useToast';
import { i18n } from '../i18n';
import { router } from '../router';
import { useSessionStore } from '../stores/session.store';
import type { paths } from './schema';

// Same-origin: kamal-proxy routes /api to the API in production, Vite's dev
// proxy locally. schema.d.ts paths leave out the API's /api prefix (Swagger
// ignores it), so it's added back here.
const baseUrl = '/api';

export const apiClient = createClient<paths>({
  baseUrl,
  credentials: 'include',
});

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// fetch rejects when the network is down, which callers checking only
// `response.ok` would let escape as an unhandled error. A 503 instead sends
// them down their usual failure path (error toast, `unwrap` throwing). An
// abort the caller asked for still rejects.
function networkFailure(error: unknown, signal: AbortSignal): Response {
  if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
    throw error;
  }
  return new Response(null, { status: 503, statusText: 'Service Unavailable' });
}

// The minted token, or the mint's own failed response (e.g. a 429 once its
// rate limit is hit), which the caller should see instead of its request.
async function fetchCsrfToken(signal: AbortSignal): Promise<string | Response> {
  let res: Response;
  try {
    res = await fetch(new URL(`${baseUrl}/auth/csrf-token`, window.location.origin), {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    return networkFailure(error, signal);
  }
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
    const token = await fetchCsrfToken(request.signal);
    // A failed mint answers for the request, so the caller sees its real
    // status rather than a CSRF 403. openapi-fetch then skips the fetch and
    // onResponse below.
    if (token instanceof Response) return token;
    const withCsrf = new Request(request);
    withCsrf.headers.set(CSRF_HEADER, token);
    return withCsrf;
  },
});

apiClient.use({
  onError({ error, request }) {
    return networkFailure(error, request.signal);
  },
});

// A 401 means "no active session". A failed sign-in ceremony is a 401 too,
// but fires on the sign-in page, where the redirect is a no-op. Except from
// /auth/me: that probe answers "signed out" on purpose, and the route guard
// decides where a guest belongs (register and emailed links included).
apiClient.use({
  onResponse({ response, schemaPath }) {
    if (response.status !== 401 || schemaPath === '/auth/me') return response;

    // Only the first of several parallel 401s still finds the member signed
    // in, so the notice shows once.
    let sessionExpired = false;
    try {
      const session = useSessionStore();
      // Sign-out is already on its way to sign-in.
      if (session.signingOut) return response;
      sessionExpired = session.isAuthenticated;
      session.clear();
    } catch {
      // No active Pinia: nothing to clear.
    }
    const current = router.currentRoute.value;
    if (current.name !== 'sign-in') {
      if (sessionExpired) {
        useToast().push(i18n.global.t('auth.signIn.sessionExpired'), 'info');
      }
      void router.push({
        name: 'sign-in',
        ...(current.meta.requiresAuth && current.name !== 'home'
          ? { query: { redirect: current.fullPath } }
          : {}),
      });
    }
    return response;
  },
});
