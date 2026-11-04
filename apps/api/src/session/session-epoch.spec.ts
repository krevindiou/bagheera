import type { Request } from 'express';
import { keepThroughBump, sessionEpochOf } from './session-epoch';

function session(data: Record<string, unknown>): Request['session'] {
  return data as unknown as Request['session'];
}

describe('sessionEpochOf', () => {
  it('reads the stored epoch, counting a missing one as 0', () => {
    expect(sessionEpochOf(session({ sessionEpoch: 4 }))).toBe(4);
    expect(sessionEpochOf(session({}))).toBe(0);
  });
});

describe('keepThroughBump', () => {
  it("moves the member's session from the epoch just before the bump onto the new one", () => {
    const s = session({ memberId: 'm1', sessionEpoch: 2 });
    expect(keepThroughBump(s, 'm1', 3)).toBe(true);
    expect(s.sessionEpoch).toBe(3);
  });

  it('moves a session without an epoch when the bump is the first', () => {
    const s = session({ memberId: 'm1' });
    expect(keepThroughBump(s, 'm1', 1)).toBe(true);
    expect(s.sessionEpoch).toBe(1);
  });

  it('leaves a session already ended by an earlier bump where it is', () => {
    const s = session({ memberId: 'm1', sessionEpoch: 1 });
    expect(keepThroughBump(s, 'm1', 3)).toBe(false);
    expect(s.sessionEpoch).toBe(1);
  });

  it("leaves another member's session, or none at all, alone", () => {
    const other = session({ memberId: 'm2', sessionEpoch: 0 });
    expect(keepThroughBump(other, 'm1', 1)).toBe(false);
    expect(other.sessionEpoch).toBe(0);
    expect(keepThroughBump(session({}), 'm1', 1)).toBe(false);
    expect(keepThroughBump(undefined, 'm1', 1)).toBe(false);
  });
});
