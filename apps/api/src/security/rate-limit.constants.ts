import type { Request } from 'express';

export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

// Runtime twin of eslint.config.mjs's MUTATING_HTTP_DECORATORS.
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingRequest(req: Request): boolean {
  return MUTATING_METHODS.has(req.method);
}

// The IP dimension is looser than the identifier one: many legitimate
// accounts can share an address (NAT), so the per-account limit should
// bite first.
const DEFAULT_IP_BUDGET_MULTIPLIER = 4;

export interface RateLimitOptions {
  /** Requests allowed within `durationSeconds` before throttling kicks in. */
  points: number;
  durationSeconds: number;
  /**
   * `req.body` field naming a second, independent dimension (e.g.
   * `'email'`). Absent from the body: only the IP dimension applies.
   */
  identifierField?: string;
  /**
   * The IP dimension's budget. Defaults to `points *
   * DEFAULT_IP_BUDGET_MULTIPLIER`, or `points` without `identifierField`.
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
   * Key the budget on the signed-in member instead of the address, so a
   * shared address doesn't pool everyone's requests. Falls back to the
   * address without a member.
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
