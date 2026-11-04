import { BusinessError } from '../common/filters/business-error';
import { consumeStepUp, STEP_UP_TTL_MS } from './consume-step-up';
import { fakeRequest } from '../test-support/fake-http-context';

function stepUpRequest(session: Record<string, unknown>) {
  return fakeRequest({ session: { memberId: 'm1', ...session } as never });
}

function expectStepUpRequired(run: () => void) {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(BusinessError);
    expect((err as BusinessError).getStatus()).toBe(422);
    expect((err as BusinessError).getResponse()).toMatchObject({ code: 'step_up_required' });
    return;
  }
  throw new Error('expected consumeStepUp to throw');
}

describe('consumeStepUp', () => {
  it('passes for a fresh step-up proof, consuming it', () => {
    const req = stepUpRequest({ stepUpVerifiedAt: Date.now(), stepUpVerifiedMemberId: 'm1' });
    expect(() => consumeStepUp(req)).not.toThrow();
    expect(req.session.stepUpVerifiedAt).toBeUndefined();
    expect(req.session.stepUpVerifiedMemberId).toBeUndefined();
  });

  it('throws a 422 with the step_up_required code when no step-up was verified', () => {
    expectStepUpRequired(() => consumeStepUp(stepUpRequest({})));
  });

  it('throws a 422 for a proof older than the TTL, still consuming it', () => {
    const req = stepUpRequest({
      stepUpVerifiedAt: Date.now() - STEP_UP_TTL_MS - 1,
      stepUpVerifiedMemberId: 'm1',
    });
    expectStepUpRequired(() => consumeStepUp(req));
    expect(req.session.stepUpVerifiedAt).toBeUndefined();
  });

  it('throws a 422 for a proof granted to another member, still consuming it', () => {
    const req = stepUpRequest({ stepUpVerifiedAt: Date.now(), stepUpVerifiedMemberId: 'm2' });
    expectStepUpRequired(() => consumeStepUp(req));
    expect(req.session.stepUpVerifiedAt).toBeUndefined();
    expect(req.session.stepUpVerifiedMemberId).toBeUndefined();
  });

  it('throws a 422 for a proof naming no member', () => {
    expectStepUpRequired(() => consumeStepUp(stepUpRequest({ stepUpVerifiedAt: Date.now() })));
  });

  it('is single-use — one proof never authorizes a second action', () => {
    const req = stepUpRequest({ stepUpVerifiedAt: Date.now(), stepUpVerifiedMemberId: 'm1' });
    consumeStepUp(req);
    expectStepUpRequired(() => consumeStepUp(req));
  });
});
