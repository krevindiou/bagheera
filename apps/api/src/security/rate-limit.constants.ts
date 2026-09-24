import type { Request } from 'express';

export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

// Mirrors eslint.config.mjs's MUTATING_HTTP_DECORATORS — kept as a separate
// runtime list rather than shared, since one reads decorator names off an
// AST at lint time and the other reads `req.method` at request time.
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingRequest(req: Request): boolean {
  return MUTATING_METHODS.has(req.method);
}

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
   * dimension (e.g. `'email'` for registration) alongside the source IP —
   * an account limit and a source-address limit are each
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
  /**
   * Narrows the budget to the requests this returns true for; the rest pass
   * straight through without consuming anything. For a route whose cost
   * depends on the caller's state — e.g. the CSRF mint only stores anything
   * for a caller that has no session yet.
   */
  appliesTo?: (req: Request) => boolean;
  /**
   * Key the budget on the signed-in member rather than the source address:
   * on an authenticated route the member is who's accountable, and a
   * shared address (a household behind one router, an office) mustn't pool
   * everyone's requests. Falls back to the address when there's no member.
   */
  perMember?: boolean;
  /** Share one counter across every route naming the same scope, instead of one per route. */
  scope?: string;
}

export function ipPointsFor(options: RateLimitOptions): number {
  if (options.ipPoints !== undefined) {
    return options.ipPoints;
  }
  return options.identifierField ? options.points * DEFAULT_IP_BUDGET_MULTIPLIER : options.points;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 5,
  durationSeconds: 60,
};

/**
 * Every create, edit and delete a member makes, across all their data, draws
 * on one shared budget. Plenty for anyone clicking through the app; what it
 * stops is a script, where one request can cost the database far more than
 * itself (a scheduler save generates up to a thousand operations).
 */
export const MEMBER_WRITE_LIMIT: RateLimitOptions = {
  points: 60,
  durationSeconds: 60,
  perMember: true,
  scope: 'member-writes',
  appliesTo: isMutatingRequest,
};

/** Operation search, on every verb: reading a remembered search runs it again. */
export const MEMBER_SEARCH_LIMIT: RateLimitOptions = {
  points: 60,
  durationSeconds: 60,
  perMember: true,
  scope: 'member-searches',
};
