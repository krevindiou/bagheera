import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Marks a route (or an entire controller) as deliberately not rate-limited
 * — the reasoning belongs in a comment at the call site.
 *
 * Real at runtime: `RateLimitGuard` is registered globally (`SecurityModule`)
 * and checks this decorator first, returning immediately if it's set — see
 * that guard's own doc for the full resolution order. On mutating handlers
 * it's also checked by the `local/require-rate-limit-decision` eslint rule
 * (`eslint.config.mjs`), which fails the build on one with neither this nor
 * `@RateLimit(...)` — so "not rate-limited" is a decision on record, not
 * silence a future audit has to interpret.
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, true);
