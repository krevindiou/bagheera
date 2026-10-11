import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { findMemberByEmail } from './find-member-by-email';
import { raceSafeUniqueEmail } from './race-safe-unique-email';
import { vi } from 'vitest';

vi.mock('./find-member-by-email', () => ({ findMemberByEmail: vi.fn() }));

const db = {} as NodePgDatabase;

function heldBy(id: string | undefined): void {
  vi.mocked(findMemberByEmail).mockResolvedValue(
    id === undefined ? undefined : { id, email: 'holder@example.com', locale: 'en' },
  );
}

describe('raceSafeUniqueEmail', () => {
  beforeEach(() => {
    vi.mocked(findMemberByEmail).mockReset();
  });

  it('fails without calling write when the email belongs to another member', async () => {
    heldBy('other-member');
    const write = vi.fn();
    const result = await raceSafeUniqueEmail(db, 'taken@example.com', write);
    expect(result).toEqual({ ok: false });
    expect(findMemberByEmail).toHaveBeenCalledWith(db, 'taken@example.com');
    expect(write).not.toHaveBeenCalled();
  });

  it("proceeds to write when the only existing row is the caller's own (excludeId)", async () => {
    heldBy('member-1');
    const write = vi.fn().mockResolvedValue('written');
    const result = await raceSafeUniqueEmail(db, 'own@example.com', write, 'member-1');
    expect(result).toEqual({ ok: true, value: 'written' });
    expect(write).toHaveBeenCalled();
  });

  it('succeeds when no row exists and write resolves', async () => {
    heldBy(undefined);
    const write = vi.fn().mockResolvedValue('created');
    const result = await raceSafeUniqueEmail(db, 'new@example.com', write);
    expect(result).toEqual({ ok: true, value: 'created' });
  });

  it('fails when the precheck passed but write hits the unique index (TOCTOU race)', async () => {
    heldBy(undefined);
    const write = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('duplicate key'), { cause: { code: '23505' } }));
    const result = await raceSafeUniqueEmail(db, 'raced@example.com', write);
    expect(result).toEqual({ ok: false });
  });

  it('rethrows a write failure unrelated to the unique index', async () => {
    heldBy(undefined);
    const write = vi.fn().mockRejectedValue(new Error('connection lost'));
    await expect(raceSafeUniqueEmail(db, 'x@example.com', write)).rejects.toThrow(
      'connection lost',
    );
  });
});
