import { ConfigService } from '@nestjs/config';
import { doubleCsrf, DoubleCsrfUtilities } from 'csrf-csrf';

/** Shared so tests can mint a valid token/cookie pair the same way the app does. */
export function buildCsrf(config: ConfigService): DoubleCsrfUtilities {
  return doubleCsrf({
    getSecret: () => config.getOrThrow<string>('CSRF_SECRET'),
    getSessionIdentifier: (req) => req.session.id,
    cookieName: 'bagheera.csrf',
    cookieOptions: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
      path: '/',
    },
  });
}
