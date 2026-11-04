import type { Request } from 'express';
import type { SessionData } from 'express-session';

/** Whether a session carries nothing but its cookie: nothing worth storing. */
export function holdsOnlyCookie(session: Partial<SessionData>): boolean {
  return Object.keys(session).every((key) => key === 'cookie');
}

/**
 * Whether express-session generated this request's session just now. With
 * `saveUninitialized: false` (and SessionStore refusing to keep an empty
 * one), a stored session always holds more than its cookie; a fresh one
 * holds nothing until a handler writes to it (which is what stores it).
 */
export function isNewSession(req: Request): boolean {
  return !req.session || holdsOnlyCookie(req.session);
}
