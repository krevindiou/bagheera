import { SetMetadata } from '@nestjs/common';

/**
 * Opts a route (or an entire controller) out of `SessionAuthGuard`'s
 * blanket "must have a signed-in session" check — for the handful of
 * endpoints that are reachable without one: passkey sign-in/out,
 * registration, the WebAuthn sign-up ceremony, the CSRF token mint, and
 * health.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
