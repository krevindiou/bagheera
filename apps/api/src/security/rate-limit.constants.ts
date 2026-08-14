export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

export interface RateLimitOptions {
  /** Requests allowed within `durationSeconds` before throttling kicks in. */
  points: number;
  durationSeconds: number;
  /**
   * Field read off `req.body` to build part of the throttle key (e.g.
   * `'email'` for a sign-in endpoint) — combined with the source IP so
   * distinct identifiers/IPs are throttled independently. Falls back to
   * `'*'` (IP-only throttling) when absent or the field is missing.
   */
  identifierField?: string;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 5,
  durationSeconds: 60,
};
