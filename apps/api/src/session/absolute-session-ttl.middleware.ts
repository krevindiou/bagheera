import type { NextFunction, Request, Response } from 'express';
import { isNewSession } from './is-new-session';
import './session-data';
import { sessionMaxAgeMs } from './session-store';

/**
 * The rolling cookie only enforces an idle timeout; this adds the absolute
 * cap (8h signed in, one idle timeout otherwise), counted from the
 * `createdAt` SessionStore stamps on first save. A session past it is
 * swapped for a fresh one, so CSRF checks and the token mint further down
 * still find a session to read.
 *
 * A session stored without `createdAt` (by a release that didn't stamp it
 * on save) is stamped the first time it comes back. One generated for this
 * request is left alone: stamping it would make express-session store it
 * and set a cookie on every anonymous request.
 */
export function absoluteSessionTtl(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session) {
    next();
    return;
  }
  if (req.session.createdAt === undefined) {
    if (!isNewSession(req)) {
      req.session.createdAt = Date.now();
    }
    next();
    return;
  }
  if (Date.now() - req.session.createdAt > sessionMaxAgeMs(req.session)) {
    req.session.regenerate(() => next());
    return;
  }
  next();
}
