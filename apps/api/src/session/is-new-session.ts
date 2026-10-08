import type { Request } from 'express';

/**
 * Whether express-session generated this request's session just now. With
 * `saveUninitialized: false`, a stored session always holds more than its
 * cookie; a fresh one holds nothing until a handler writes to it (which is
 * what stores it).
 */
export function isNewSession(req: Request): boolean {
  return !req.session || Object.keys(req.session).every((key) => key === 'cookie');
}
