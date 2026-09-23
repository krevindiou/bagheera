import { NextFunction, Request, Response } from 'express';
import { isNewSession } from './is-new-session';
import { SESSION_MAX_AGE_MS } from './session.constants';

declare module 'express-session' {
  interface SessionData {
    createdAt?: number;
  }
}

/**
 * express-session's rolling cookie only enforces an idle timeout. This
 * enforces the 24h absolute cap: the first time a stored session comes back
 * it stamps `createdAt`; once that's more than 24h in the past the session
 * is destroyed regardless of recent activity.
 *
 * A session generated for this very request is left alone: stamping it
 * would mark it modified, so express-session would store it and send a
 * cookie for every anonymous request — health checks and any other GET
 * included — rather than only for the ones that keep something (the CSRF
 * mint, sign-in). Its clock starts on its next request instead, at most one
 * idle timeout later.
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
