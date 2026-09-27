import type { Request, Response } from 'express';
import { apiResponseHeaders } from './api-response-headers';
import { vi } from 'vitest';

describe('apiResponseHeaders', () => {
  it('keeps every API response out of search indexes and out of any cache', () => {
    const setHeader = vi.fn();
    const next = vi.fn();

    apiResponseHeaders({} as Request, { setHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalledWith();
  });
});
