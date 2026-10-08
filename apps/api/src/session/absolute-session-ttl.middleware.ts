import { NextFunction, Request, Response } from 'express';
import { isNewSession } from './is-new-session';
import { SESSION_MAX_AGE_MS } from './session.constants';

declare module 'express-session' {
  interface SessionData {
    createdAt?: number;
  }
}

/**
 * The rolling cookie only enforces an idle timeout; this adds the 24h
 * absolute cap. A stored session gets `createdAt` stamped the first time it
 * comes back, and is destroyed once that's over 24h old.
 *
 * A session generated for this request is left alone: stamping it would
 * make express-session store it and set a cookie on every anonymous
 * request. Its clock starts on its next request, at most one idle timeout
 * later.
 */
export function absoluteSessionTtl(req: Request, res: Response, next: NextFunction): void {
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
  if (Date.now() - req.session.createdAt > SESSION_MAX_AGE_MS) {
    req.session.destroy(() => next());
    return;
  }
  next();
}
