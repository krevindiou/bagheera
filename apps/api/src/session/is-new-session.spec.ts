import { isNewSession } from './is-new-session';
import { fakeRequest } from '../test-support/fake-http-context';

describe('isNewSession', () => {
  it('is true for a session holding nothing but its cookie', () => {
    const req = fakeRequest({ session: { cookie: {} } as never });
    expect(isNewSession(req)).toBe(true);
  });

  it('is false once the session carries anything else', () => {
    const req = fakeRequest({ session: { cookie: {}, csrfIssued: true } as never });
    expect(isNewSession(req)).toBe(false);
  });

  // absoluteSessionTtl's destroy() removes req.session outright.
  it('is true when the request has no session at all', () => {
    const req = fakeRequest({ session: undefined as never });
    expect(isNewSession(req)).toBe(true);
  });
});
