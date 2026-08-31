import { SetMetadata } from '@nestjs/common';

/**
 * Opts a route (or an entire controller) out of `SessionAuthGuard`'s
 * blanket "must have a signed-in session" check — for the handful of
 * endpoints that are reachable without one: sign-in/out, registration,
 * activation, password recovery, the CSRF token mint, and health.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
