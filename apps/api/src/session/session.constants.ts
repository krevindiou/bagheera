export const VALKEY_CLIENT = Symbol('VALKEY_CLIENT');

export const SESSION_COOKIE_NAME = 'bagheera.sid';

/** Idle timeout: session expires 30 minutes after the last request. */
export const SESSION_IDLE_TTL_SECONDS = 30 * 60;

/** Absolute cap: session is force-expired 24h after it was first created,
 * regardless of activity. */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
