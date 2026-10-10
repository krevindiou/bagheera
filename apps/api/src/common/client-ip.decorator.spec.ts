import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { ClientIp, clientIp } from './client-ip.decorator';

function factoryOf(decorator: ParameterDecorator) {
  class Host {
    handler() {}
  }
  decorator(Host.prototype, 'handler', 0);
  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Host, 'handler') as Record<
    string,
    { factory: (data: unknown, ctx: unknown) => unknown }
  >;
  return Object.values(meta)[0].factory;
}

const ctxWith = (req: unknown) => ({ switchToHttp: () => ({ getRequest: () => req }) });

describe('ClientIp', () => {
  const factory = factoryOf(ClientIp());

  it("returns the request's address", () => {
    expect(factory(undefined, ctxWith({ ip: '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it("falls back to 'unknown' when the address is missing", () => {
    expect(factory(undefined, ctxWith({}))).toBe('unknown');
  });
});

describe('clientIp', () => {
  it("returns the request's address, else 'unknown'", () => {
    expect(clientIp({ ip: '203.0.113.7' } as Request)).toBe('203.0.113.7');
    expect(clientIp({} as Request)).toBe('unknown');
  });
});
