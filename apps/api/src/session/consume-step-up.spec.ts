import { vi } from 'vitest';
import { BusinessError } from '../common/filters/business-error';
import { fakeRequest } from '../test-support/fake-http-context';
import { FakeValkey } from '../test-support/fake-valkey';
import { consumeStepUp, grantStepUp, STEP_UP_TTL_MS } from './consume-step-up';
import { SingleUseStore } from './single-use-store';

function setup(session: { memberId?: string } = { memberId: 'm1' }) {
  const store = new SingleUseStore(new FakeValkey().asClient());
  const req = fakeRequest({ sessionID: 'sid-1', session: session as never });
  return { store, req };
}

async function expectStepUpRequired(run: Promise<void>) {
  const err: unknown = await run.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(BusinessError);
  expect((err as BusinessError).getStatus()).toBe(422);
  expect((err as BusinessError).getResponse()).toMatchObject({ code: 'step_up_required' });
}

describe('consumeStepUp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes for a fresh step-up proof, consuming it', async () => {
    const { store, req } = setup();
    await grantStepUp(store, req, 'm1');

    await expect(consumeStepUp(store, req)).resolves.toBeUndefined();
    expect(await store.take(req, 'stepUpProof')).toBeUndefined();
  });

  it('throws a 422 with the step_up_required code when no step-up was verified', async () => {
    const { store, req } = setup();
    await expectStepUpRequired(consumeStepUp(store, req));
  });

  it('throws a 422 for a proof older than the TTL', async () => {
    vi.useFakeTimers();
    const { store, req } = setup();
    await grantStepUp(store, req, 'm1');

    vi.advanceTimersByTime(STEP_UP_TTL_MS + 1);

    await expectStepUpRequired(consumeStepUp(store, req));
  });

  it('throws a 422 for a proof granted to another member, still consuming it', async () => {
    const { store, req } = setup();
    await grantStepUp(store, req, 'm2');

    await expectStepUpRequired(consumeStepUp(store, req));
    expect(await store.take(req, 'stepUpProof')).toBeUndefined();
  });

  it('throws a 422 on a session with no member', async () => {
    const { store, req } = setup({});
    await grantStepUp(store, req, 'm1');

    await expectStepUpRequired(consumeStepUp(store, req));
  });

  it('is single-use — one proof never authorizes a second action', async () => {
    const { store, req } = setup();
    await grantStepUp(store, req, 'm1');

    await consumeStepUp(store, req);
    await expectStepUpRequired(consumeStepUp(store, req));
  });

  it('lets only one of several concurrent consumers through', async () => {
    const { store, req } = setup();
    await grantStepUp(store, req, 'm1');

    const results = await Promise.allSettled([
      consumeStepUp(store, req),
      consumeStepUp(store, req),
      consumeStepUp(store, req),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
