import { UnprocessableEntityException } from '@nestjs/common';
import { consumeStepUp, STEP_UP_TTL_MS } from './consume-step-up';
import { fakeRequest } from '../test-support/fake-http-context';

describe('consumeStepUp', () => {
  it('passes for a fresh step-up proof, consuming it', () => {
    const req = fakeRequest({ session: { stepUpVerifiedAt: Date.now() } as never });
    expect(() => consumeStepUp(req)).not.toThrow();
    expect(req.session.stepUpVerifiedAt).toBeUndefined();
  });

  it('throws a 422 when no step-up was verified', () => {
    const req = fakeRequest({ session: {} as never });
    expect(() => consumeStepUp(req)).toThrow(UnprocessableEntityException);
  });

  it('throws a 422 for a proof older than the TTL, still consuming it', () => {
    const req = fakeRequest({
      session: { stepUpVerifiedAt: Date.now() - STEP_UP_TTL_MS - 1 } as never,
    });
    expect(() => consumeStepUp(req)).toThrow(UnprocessableEntityException);
    expect(req.session.stepUpVerifiedAt).toBeUndefined();
  });

  it('is single-use — one proof never authorizes a second action', () => {
    const req = fakeRequest({ session: { stepUpVerifiedAt: Date.now() } as never });
    consumeStepUp(req);
    expect(() => consumeStepUp(req)).toThrow(UnprocessableEntityException);
  });
});
