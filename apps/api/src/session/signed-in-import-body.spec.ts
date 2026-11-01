import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { NextFunction, Request, Response } from 'express';
import { IMPORT_JSON_BODY_LIMIT_BYTES } from '../common/json-body-limit';
import { signedInImportBody } from './signed-in-import-body';

describe('signedInImportBody', () => {
  const importUrl = '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/preview';
  const jsonHeaders = { 'content-type': 'application/json' };

  // A request whose body is `chunks`, as the stream express hands on.
  const requestWith = (
    chunks: Buffer[],
    fields: Record<string, unknown>,
  ): Request & { body?: unknown } =>
    Object.assign(Readable.from(chunks), fields) as unknown as Request & { body?: unknown };

  // Resolves with what `next` was called with: no argument, or the error.
  const run = (req: Request) =>
    new Promise<unknown>((resolve) => {
      const next: NextFunction = (error?: unknown) => resolve(error);
      signedInImportBody(req, {} as Response, next);
    });

  it('does not parse an anonymous import body', () => {
    const req = requestWith([Buffer.from('{"a":1}')], {
      originalUrl: importUrl,
      headers: jsonHeaders,
      session: {},
    });

    return run(req).then((error) => {
      expect(error).toBeUndefined();
      expect(req.body).toBeUndefined();
    });
  });

  it('does not parse a session-less import body', () => {
    const req = requestWith([Buffer.from('{"a":1}')], {
      originalUrl: importUrl,
      headers: jsonHeaders,
    });

    return run(req).then(() => expect(req.body).toBeUndefined());
  });

  it('does not parse a signed-in body on any other route', () => {
    const req = requestWith([Buffer.from('{"a":1}')], {
      originalUrl: '/api/operations',
      headers: jsonHeaders,
      session: { memberId: 'm' },
    });

    return run(req).then(() => expect(req.body).toBeUndefined());
  });

  it('parses a signed-in import body as JSON', () => {
    const req = requestWith([Buffer.from('{"revision":"abc"}')], {
      originalUrl: importUrl,
      headers: jsonHeaders,
      session: { memberId: 'm' },
    });

    return run(req).then((error) => {
      expect(error).toBeUndefined();
      expect(req.body).toEqual({ revision: 'abc' });
    });
  });

  it('answers a compressed signed-in import body 415', () => {
    const req = requestWith([Buffer.from('{}')], {
      originalUrl: importUrl,
      headers: { ...jsonHeaders, 'content-encoding': 'gzip' },
      session: { memberId: 'm' },
    });

    return run(req).then((error) => expect(error).toBeInstanceOf(UnsupportedMediaTypeException));
  });

  it('answers a signed-in import body over 2 MB 413', () => {
    const half = Buffer.alloc(IMPORT_JSON_BODY_LIMIT_BYTES / 2 + 1, 'x');
    const req = requestWith([half, half], {
      originalUrl: importUrl,
      headers: jsonHeaders,
      session: { memberId: 'm' },
    });

    return run(req).then((error) => expect(error).toBeInstanceOf(PayloadTooLargeException));
  });

  it('answers malformed JSON 400', () => {
    const req = requestWith([Buffer.from('{"a":')], {
      originalUrl: importUrl,
      headers: jsonHeaders,
      session: { memberId: 'm' },
    });

    return run(req).then((error) => expect(error).toBeInstanceOf(BadRequestException));
  });
});
