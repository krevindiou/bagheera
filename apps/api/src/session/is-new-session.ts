import type { Request } from 'express';

/**
 * Whether express-session generated this request's session just now,
 * rather than loading it from the store. With `saveUninitialized: false`
 * (session.module.ts) only a session something wrote to ever reaches the
 * store, so a loaded one always carries data beyond its cookie; a fresh one
 * holds nothing else until a handler writes to it, which is exactly what
 * then gets it stored — one more Valkey key.
 */
export function isNewSession(req: Request): boolean {
  return !req.session || Object.keys(req.session).every((key) => key === 'cookie');
}
