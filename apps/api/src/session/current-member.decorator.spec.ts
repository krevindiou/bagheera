import { UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentMember } from './current-member.decorator';

// Param decorators only expose their factory through route-arg metadata.
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

describe('CurrentMember', () => {
  const factory = factoryOf(CurrentMember());

  it('returns the signed-in member id', () => {
    expect(factory(undefined, ctxWith({ session: { memberId: 'm1' } }))).toBe('m1');
  });

  it('throws when there is no signed-in member', () => {
    expect(() => factory(undefined, ctxWith({ session: {} }))).toThrow(UnauthorizedException);
  });
});
