export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

// The IP dimension defaults to a looser budget than the identifier
// dimension: many legitimate accounts can share one source address (NAT,
// a corporate gateway), so the account-level limit is what should bite
// first for credential stuffing. The IP dimension still exists and still
// throttles independently — it's what stops account spraying — it's just
// not tuned to trip at the same low threshold as a single targeted
// account.
const DEFAULT_IP_BUDGET_MULTIPLIER = 4;

export interface RateLimitOptions {
  /** Requests allowed within `durationSeconds` before throttling kicks in. */
  points: number;
  durationSeconds: number;
  /**
   * Field read off `req.body` to name a second, independent throttle
   * dimension (e.g. `'email'` for a sign-in endpoint) alongside the
   * source IP — an account limit and a source-address limit are each
   * required, checked and throttled separately, so exceeding either one
   * rejects the request and rotating the other dimension doesn't help an
   * attacker dodge it. Absent or missing on the body: only the IP
   * dimension applies.
   */
  identifierField?: string;
  /**
   * Requests allowed for the source-IP dimension within `durationSeconds`.
   * Defaults to `points * DEFAULT_IP_BUDGET_MULTIPLIER` (or to `points`
   * itself when there's no `identifierField`, i.e. IP is the only
   * dimension). Override to tune the two dimensions independently.
   */
  ipPoints?: number;
}

export function ipPointsFor(options: RateLimitOptions): number {
  if (options.ipPoints !== undefined) {
    return options.ipPoints;
  }
  return options.identifierField
    ? options.points * DEFAULT_IP_BUDGET_MULTIPLIER
    : options.points;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 5,
  durationSeconds: 60,
};
