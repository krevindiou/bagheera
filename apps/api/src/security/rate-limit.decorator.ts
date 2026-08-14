import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_OPTIONS, RateLimitOptions } from './rate-limit.constants';

/** Overrides the default rate-limit budget for a specific route/controller. */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_OPTIONS, options);
