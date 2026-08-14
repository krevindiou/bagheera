export const VALKEY_CLIENT = Symbol('VALKEY_CLIENT');

export const SESSION_COOKIE_NAME = 'bagheera.sid';

/**
 * Idle timeout: session expires this many seconds after the last request.
 * Defaults to 30 minutes; overridable via `SESSION_IDLE_TTL_SECONDS` so the
 * E2E idle-timeout journey can use a short-lived session instead of
 * actually waiting half an hour.
 */
export const SESSION_IDLE_TTL_SECONDS = process.env.SESSION_IDLE_TTL_SECONDS
  ? Number(process.env.SESSION_IDLE_TTL_SECONDS)
  : 30 * 60;

/** Absolute cap: session is force-expired 24h after it was first created,
 * regardless of activity. */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
