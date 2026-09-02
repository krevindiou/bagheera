import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Marks a mutating route (or an entire controller) as deliberately not
 * rate-limited — the reasoning belongs in a comment at the call site.
 *
 * Purely a lint-time marker today: RateLimitGuard is opt-in per route
 * (`@UseGuards(RateLimitGuard)` + `@RateLimit(...)`), not global, so this
 * decorator has no runtime effect yet. It's checked by the
 * `local/require-rate-limit-decision` eslint rule (eslint.config.mjs),
 * which fails the build on a mutating handler with neither this nor
 * `@RateLimit(...)` — so "not rate-limited" is a decision on record, not
 * silence a future audit has to interpret. Going further — enforcing this
 * at runtime via a global guard, the way `SessionAuthGuard` enforces
 * sign-in — is a separate, not-yet-taken decision: it needs a default
 * budget for ordinary CRUD validated against real traffic first, since the
 * tight budget used on the auth-adjacent routes today would also throttle
 * routes marked with this decorator.
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, true);
