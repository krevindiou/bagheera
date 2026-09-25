import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { fakeArgumentsHost, fakeRequest, fakeResponse } from '../../test-support/fake-http-context';

// @sentry/node's named exports aren't spy-able in place (frozen/read-only
// bindings) — a full module mock sidesteps that instead of fighting it.
jest.mock('@sentry/node');
import { Sentry } from '../../logging/sentry';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  // Kept as its own variable (rather than re-reading Logger.prototype.error
  // in each assertion) so assertions read off a plain jest.SpyInstance,
  // not a reference extracted off the real Logger class — the latter trips
  // @typescript-eslint/unbound-method, a false positive for jest matchers.
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (Sentry.captureException as jest.Mock).mockReturnValue('event-id');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (Sentry.captureException as jest.Mock).mockClear();
  });

  it("uses an HttpException's string response as the message", async () => {
    const res = fakeResponse();
    await filter.catch(
      new HttpException('plain message', 400),
      fakeArgumentsHost(fakeRequest(), res),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        category: 'validation_error',
        message: 'plain message',
      }),
    );
  });

  it('adds a stable code (and params) to translatable business errors', async () => {
    const res = fakeResponse();
    await filter.catch(
      new HttpException('You can have at most 50 banks.', 422),
      fakeArgumentsHost(fakeRequest(), res),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'quota_exceeded',
        params: { limit: 50, kind: 'banks' },
        message: 'You can have at most 50 banks.',
      }),
    );
  });

  it("uses an HttpException's object {message} response as-is (e.g. class-validator's array)", async () => {
    const res = fakeResponse();
    const exception = new BadRequestException({
      message: ['field is required'],
    });
    await filter.catch(exception, fakeArgumentsHost(fakeRequest(), res));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ['field is required'] }),
    );
  });

  it('falls back to exception.message when the response body has no message property', async () => {
    const res = fakeResponse();
    class NoBodyException extends HttpException {
      constructor() {
        super({ notMessage: 'x' }, 400);
      }
    }
    await filter.catch(new NoBodyException(), fakeArgumentsHost(fakeRequest(), res));
    // Nest's HttpException.message defaults to the status text when the
    // response body carries no usable message of its own.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.any() is untyped (any) in @types/jest */
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it('logs and reports to Sentry, then returns a generic 500 body, for a plain Error', async () => {
    const res = fakeResponse();
    await filter.catch(new Error('boom'), fakeArgumentsHost(fakeRequest(), res));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        category: 'error',
        message: 'Internal server error',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('passes an exposed http-errors-style error through at its own status, without logging', async () => {
    const res = fakeResponse();
    const httpError = Object.assign(new Error('CSRF token mismatch'), {
      statusCode: 403,
      expose: true,
    });
    await filter.catch(httpError, fakeArgumentsHost(fakeRequest(), res));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        category: 'access_denied',
        message: 'CSRF token mismatch',
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('treats a statusCode-bearing error without expose:true as an ordinary 500, not an exposed error', async () => {
    const res = fakeResponse();
    const lookalike = Object.assign(new Error('internal detail'), {
      statusCode: 403,
    });
    await filter.catch(lookalike, fakeArgumentsHost(fakeRequest(), res));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  // extractMessage()'s `exception instanceof Error ? exception.message :
  // 'Unknown error'` fallback looks reachable for a non-Error throw, but
  // isn't: statusCodeOf() only ever returns something other than 500 for
  // an HttpException (handled earlier) or an isExposedHttpError() match,
  // which itself requires `exception instanceof Error`. So any non-Error
  // throw always has statusCode === 500, and extractMessage returns
  // 'Internal server error' one branch earlier — 'Unknown error' is
  // currently dead code, not exercised by this or any other case.
  it('reports a generic "Internal server error", not the raw value, for a thrown non-Error', async () => {
    const res = fakeResponse();
    await filter.catch('a raw string throw', fakeArgumentsHost(fakeRequest(), res));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('stamps the request path and an ISO timestamp on every response', async () => {
    const res = fakeResponse();
    await filter.catch(
      new HttpException('x', 404),
      fakeArgumentsHost(fakeRequest({ url: '/accounts/1' }), res),
    );

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.stringMatching() is untyped (any) in @types/jest */
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/accounts/1',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });
});
