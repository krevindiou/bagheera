import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Same-origin in production (Caddy proxies API requests to the API
// service); local dev talks to the API dev server via Vite's dev proxy.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/";

export const apiClient = createClient<paths>({
  baseUrl,
  credentials: "include",
});
