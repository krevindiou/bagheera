import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Marks a route or controller as deliberately not rate-limited; explain why
 * at the call site. Satisfies the `local/require-rate-limit-decision`
 * eslint rule, like `@RateLimit(...)`.
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, true);
