import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../security/audit.service';
import { SignInThrottleAuditFilter } from './sign-in-throttle-audit.filter';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { fakeArgumentsHost, fakeRequest, fakeResponse } from '../test-support/fake-http-context';

// A plain shape, not typed as AuditService itself — extracting `.record`
// off a value typed as the real class trips
// @typescript-eslint/unbound-method (a false positive for jest's
// expect(fn).toHaveBeenCalledWith(...), which never invokes the method
// with a foreign `this`). Cast to AuditService only where a constructor
// actually needs it.
function fakeAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

describe('SignInThrottleAuditFilter', () => {
  it('records sign_in_throttled and rewrites a 429 into the generic invalid-credentials 401', async () => {
    const audit = fakeAudit();
    const filter = new SignInThrottleAuditFilter(audit as unknown as AuditService);
    const res = fakeResponse();
    const req = fakeRequest({ ip: '10.0.0.1' });

    await filter.catch(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      fakeArgumentsHost(req, res),
    );

    expect(audit.record).toHaveBeenCalledWith('sign_in_throttled', null, '10.0.0.1');
    expect(res.status).toHaveBeenCalledWith(401);
    // Must match SignInService's own wording exactly — a throttled attempt
    // must be indistinguishable from an ordinary wrong-password failure.
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid email or password' }),
    );
  });

  it('falls back to "unknown" when the request has no IP', async () => {
    const audit = fakeAudit();
    const filter = new SignInThrottleAuditFilter(audit as unknown as AuditService);
    await filter.catch(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      fakeArgumentsHost(fakeRequest({ ip: undefined }), fakeResponse()),
    );
    expect(audit.record).toHaveBeenCalledWith('sign_in_throttled', null, 'unknown');
  });

  it('delegates any other exception straight to GlobalExceptionFilter, without recording an audit event', async () => {
    const audit = fakeAudit();
    const filter = new SignInThrottleAuditFilter(audit as unknown as AuditService);
    const superCatch = jest.spyOn(GlobalExceptionFilter.prototype, 'catch');
    const res = fakeResponse();
    const host = fakeArgumentsHost(fakeRequest(), res);

    await filter.catch(new UnauthorizedException('bad password'), host);

    expect(audit.record).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad password' }));
    superCatch.mockRestore();
  });
});
