import type { Router } from 'vue-router';

const PROBE_ORIGIN = 'https://in-app.invalid';

/**
 * The in-app path a `redirect` query value points to, or null unless it is
 * a same-origin path to a known page other than sign-in/register. Guards
 * against open redirects through the sign-in page.
 */
export function safeRedirect(router: Router, value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  // Parsed the way a browser would: it reads "\" as "/" and drops tabs and
  // newlines, so "/\evil.example" or "/\t/evil.example" leave the origin.
  if (new URL(value, PROBE_ORIGIN).origin !== PROBE_ORIGIN) {
    return null;
  }
  const resolved = router.resolve(value);
  // Unnamed means the catch-all (or `/`), which only bounces elsewhere.
  if (typeof resolved.name !== 'string' || resolved.meta.guestOnly) {
    return null;
  }
  return resolved.fullPath;
}
