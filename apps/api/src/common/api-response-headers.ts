import type { NextFunction, Request, Response } from 'express';

/**
 * Headers every API response carries: crawlers mustn't index it (spec
 * section 7), and neither the browser nor anything in between may store
 * it — balances and operations would otherwise sit in the disk cache of
 * whatever machine the member used.
 */
export function apiResponseHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  next();
}
