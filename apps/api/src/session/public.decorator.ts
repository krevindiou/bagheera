import { SetMetadata } from '@nestjs/common';

/**
 * Opts a route or controller out of `SessionAuthGuard`'s signed-in check
 * (sign-in, sign-up, the CSRF mint, health, …).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
