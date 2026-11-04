import type { Request } from 'express';
import { vi } from 'vitest';
import { SessionRotationService } from './session-rotation.service';

type Callback = (err?: unknown) => void;

// A session whose regenerate() swaps in a fresh, empty data object the way
// express-session does, and whose callbacks report the given errors.
function fakeRequest(
  data: Record<string, unknown>,
  { regenerateError, saveError }: { regenerateError?: unknown; saveError?: unknown } = {},
) {
  const req = {} as { session: Record<string, unknown> };
  const session: Record<string, unknown> = {
    ...data,
    cookie: { maxAge: 1000 },
    regenerate: vi.fn((cb: Callback) => {
      for (const key of Object.keys(data)) delete session[key];
      cb(regenerateError);
    }),
    save: vi.fn((cb: Callback) => cb(saveError)),
  };
  req.session = session;
  return { req: req as unknown as Request, session };
}

describe('SessionRotationService', () => {
  const service = new SessionRotationService();

  it('regenerates the session, carries its browser-level fields over, and saves it', async () => {
    const { req, session } = fakeRequest({ createdAt: 1234, csrfIssued: true });

    await service.rotate(req);

    expect(session.regenerate).toHaveBeenCalled();
    expect(session.save).toHaveBeenCalled();
    expect(session.createdAt).toBe(1234);
    expect(session.csrfIssued).toBe(true);
  });

  // Whatever the previous holder of the session proved or started must not
  // reach the account signed in next.
  it('drops identity, step-up, ceremony and sign-up state, and any unknown field', async () => {
    const dropped = {
      memberId: 'm1',
      stepUpVerifiedAt: Date.now(),
      stepUpVerifiedMemberId: 'm1',
      stepUpChallenge: 'c1',
      stepUpChallengeIssuedAt: Date.now(),
      stepUpMemberId: 'm1',
      registrationChallenge: 'c2',
      registrationChallengeIssuedAt: Date.now(),
      webauthnChallenge: 'c3',
      webauthnChallengeIssuedAt: Date.now(),
      pendingSignupChallenge: 'c4',
      pendingSignupChallengeIssuedAt: Date.now(),
      pendingSignupKey: 'k1',
      someFutureField: 'x',
    };
    const { req, session } = fakeRequest({ ...dropped, createdAt: 1234, csrfIssued: true });

    await service.rotate(req);

    for (const key of Object.keys(dropped)) {
      expect(session[key]).toBeUndefined();
    }
    expect(session.createdAt).toBe(1234);
    expect(session.csrfIssued).toBe(true);
  });

  it('rejects with the error regenerate() reports, without saving', async () => {
    const error = new Error('store down');
    const { req, session } = fakeRequest({ memberId: 'm1' }, { regenerateError: error });

    await expect(service.rotate(req)).rejects.toBe(error);
    expect(session.save).not.toHaveBeenCalled();
  });

  it('rejects with the error save() reports', async () => {
    const error = new Error('write failed');
    const { req } = fakeRequest({ memberId: 'm1' }, { saveError: error });

    await expect(service.rotate(req)).rejects.toBe(error);
  });

  it('wraps a non-Error failure in an Error', async () => {
    const { req } = fakeRequest({ memberId: 'm1' }, { regenerateError: 'boom' });
    await expect(service.rotate(req)).rejects.toThrow(new Error('boom'));

    const { req: saveReq } = fakeRequest({ memberId: 'm1' }, { saveError: 'bang' });
    await expect(service.rotate(saveReq)).rejects.toThrow(new Error('bang'));
  });
});
