import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { vi, type Mock } from 'vitest';

/** Minimal Express/Nest context fakes for guard, filter and middleware unit specs. */

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
 * Not typed as Express's `Response`, whose method syntax trips
 * `@typescript-eslint/unbound-method` in `expect(res.status)`. `status()`
 * chains like the real one.
 */
export interface FakeResponse {
  status: Mock;
  json: Mock;
}

export function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    status: vi.fn(),
    json: vi.fn(),
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
 * `klass` only need to be stable references for a mocked `Reflector`.
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
