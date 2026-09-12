import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Shared fakes for guard/filter/middleware unit specs — these all take a
 * slice of the real Express `Request`/`Response` plus (for guards) a Nest
 * `ExecutionContext`/`ArgumentsHost`, and hand-rolling that shape per spec
 * file just repeats the same few `jest.fn()`s. Built for the "mocked DB"
 * unit-test style (see CLAUDE.md): no real Nest bootstrap, just enough
 * shape for the code under test to read.
 */

/** A minimal fake `Request`, overridable per test (e.g. `session`, `body`, `method`, `ip`). */
export function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    session: {} as Request['session'],
    body: {},
    ...overrides,
  } as Request;
}

/**
 * A fake `Response`, typed as its own plain shape rather than the real
 * Express `Response` — that type's `status`/`json` use old-style method
 * syntax, which trips `@typescript-eslint/unbound-method` the moment a spec
 * extracts `res.status`/`res.json` into `expect(...)` (a false positive:
 * jest's matchers never call the method with a foreign `this`). `status()`
 * is chainable (returns itself) like the real one.
 */
export interface FakeResponse {
  status: jest.Mock;
  json: jest.Mock;
}

export function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

/** Wraps a request/response pair as the `ArgumentsHost` an exception filter receives. */
export function fakeArgumentsHost(req: Request, res: FakeResponse): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

/**
 * Wraps a request as the `ExecutionContext` a guard receives. `handler` and
 * `klass` are only ever passed on to a mocked `Reflector` in these specs —
 * their identity doesn't matter beyond being stable, distinguishable
 * references, so plain defaults are enough unless a test asserts on them.
 */
export function fakeExecutionContext(
  req: Request,
  handler: (...args: never[]) => unknown = function targetHandler() {},
  klass: new (...args: never[]) => unknown = class TargetClass {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => fakeResponse(),
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => klass,
  } as unknown as ExecutionContext;
}
