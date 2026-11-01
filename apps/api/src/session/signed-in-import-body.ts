import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { IMPORT_JSON_BODY_LIMIT_BYTES, isImportBodyUrl, isJson } from '../common/json-body-limit';
import './session-data';

// Import bodies are parsed only for a signed-in session, and only after the
// CSRF check. Anonymous callers never get the 2 MB allowance: they skip the
// parser, and SessionAuthGuard answers 401 without reading a byte of the body.
export function signedInImportBody(req: Request, _res: Response, next: NextFunction): void {
  if (
    !isImportBodyUrl(req.originalUrl) ||
    !req.session?.memberId ||
    !isJson(req.headers['content-type'])
  ) {
    next();
    return;
  }
  if (req.headers['content-encoding']) {
    next(new UnsupportedMediaTypeException());
    return;
  }
  readJson(req, IMPORT_JSON_BODY_LIMIT_BYTES).then(
    (body) => {
      req.body = body;
      next();
    },
    (error: unknown) => next(error),
  );
}

// Resolves the parsed body, or rejects with a 413 once it outgrows `limit`.
// Past the limit the rest of the body is drained but not kept, so the
// response can still be written.
function readJson(req: Request, limit: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        if (!tooLarge) {
          tooLarge = true;
          reject(new PayloadTooLargeException());
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (tooLarge) {
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8');
      if (text === '') {
        resolve(undefined);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) {
          reject(new BadRequestException('Body must be a JSON object or array'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new BadRequestException('Body is not valid JSON'));
      }
    });
  });
}
