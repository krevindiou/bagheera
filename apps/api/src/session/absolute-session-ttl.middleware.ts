import { NextFunction, Request, Response } from 'express';
import { SESSION_MAX_AGE_MS } from './session.constants';

declare module 'express-session' {
  interface SessionData {
    createdAt?: number;
  }
}

/**
 * express-session's rolling cookie only enforces an idle timeout. This
 * enforces the 24h absolute cap: the first time a session is touched it
 * stamps `createdAt`; once that's more than 24h in the past the session is
 * destroyed regardless of recent activity.
 */
export function absoluteSessionTtl(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session) {
    next();
    return;
  }
  if (req.session.createdAt === undefined) {
    req.session.createdAt = Date.now();
    next();
    return;
  }
  if (Date.now() - req.session.createdAt > SESSION_MAX_AGE_MS) {
    req.session.destroy(() => next());
    return;
  }
  next();
}
