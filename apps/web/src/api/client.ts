import createClient from "openapi-fetch";
import { router } from "../router";
import { useSessionStore } from "../stores/session.store";
import type { paths } from "./schema";

// Same-origin in production (Caddy proxies API requests to the API
// service); local dev talks to the API dev server via Vite's dev proxy.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/";

export const apiClient = createClient<paths>({
  baseUrl,
  credentials: "include",
});

const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(new URL("auth/csrf-token", new URL(baseUrl, window.location.origin)), {
    credentials: "include",
  });
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

// The CSRF cookie is httpOnly (page scripts can't read it, so the classic
// double-submit pattern of mirroring a JS-readable cookie into a header
// doesn't apply here) — instead every mutating request mints a fresh token
// from the session first and echoes it back via the CSRF header. One extra
// round trip per mutation, but it stays correct across session-id
// rotations (sign-in) without the client having to track those itself.
apiClient.use({
  async onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) return request;
    const token = await fetchCsrfToken();
    const withCsrf = new Request(request);
    withCsrf.headers.set(CSRF_HEADER, token);
    return withCsrf;
  },
});

// Across the API, a bare 401 always means "no active session" (wrong
// credentials/passwords are 400s, ownership/state denials are 403/422) —
// including the sign-in form's own invalid-credentials response, which is
// why the currentRoute check below is enough: that case fires while
// already on the sign-in page, so the redirect is a no-op.
apiClient.use({
  onResponse({ response }) {
    if (response.status !== 401) return response;

    try {
      useSessionStore().clear();
    } catch {
      // No active Pinia instance (e.g. a bare fetch outside app context) —
      // nothing to clear.
    }
    if (router.currentRoute.value.name !== "sign-in") {
      void router.push({ name: "sign-in" });
    }
    return response;
  },
});
