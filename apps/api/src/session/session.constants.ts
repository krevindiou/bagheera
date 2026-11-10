export const VALKEY_CLIENT = Symbol('VALKEY_CLIENT');

// `__Host-` makes the browser refuse to store the cookie unless it is
// Secure, Path=/ and has no Domain — so a sibling subdomain can't plant a
// session or CSRF cookie of its own (cookie tossing) by setting one for the
// parent domain.
export const SESSION_COOKIE_NAME = '__Host-bagheera.sid';
export const CSRF_COOKIE_NAME = '__Host-bagheera.csrf';

/** Key prefix connect-redis stores sessions under (`sess:<sid>`). */
export const SESSION_KEY_PREFIX = 'sess:';

/**
 * Key prefix of a session's single-use state (`once:<sid>:<slot>`, see
 * SingleUseStore). Not under `sess:`, which connect-redis scans as sessions.
 */
export const SINGLE_USE_KEY_PREFIX = 'once:';

/**
 * Idle timeout after the last request: 30 minutes, overridable via
 * `SESSION_IDLE_TTL_SECONDS` (the E2E idle-timeout journey shortens it).
 */
export const SESSION_IDLE_TTL_SECONDS = process.env.SESSION_IDLE_TTL_SECONDS
  ? Number(process.env.SESSION_IDLE_TTL_SECONDS)
  : 30 * 60;

/** Absolute cap: session is force-expired 8h after it was first created,
 * regardless of activity — bounds a stolen cookie's useful life, while a
 * passkey sign-in to start a new one costs a single tap. */
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * Absolute cap of a session nobody signed in to: long enough for one
 * sign-in or sign-up ceremony, short enough that anonymous callers can't
 * keep sessions piling up in Valkey by refreshing them.
 */
export const ANONYMOUS_SESSION_MAX_AGE_MS = SESSION_IDLE_TTL_SECONDS * 1000;
