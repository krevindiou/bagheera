import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { raceSafeUniqueEmail } from './race-safe-unique-email';

function fakeDb(existingRows: { id: string }[]): NodePgDatabase {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(existingRows),
      }),
    }),
  } as unknown as NodePgDatabase;
}

describe('raceSafeUniqueEmail', () => {
  it('fails without calling write when the email belongs to another member', async () => {
    const db = fakeDb([{ id: 'other-member' }]);
    const write = jest.fn();
    const result = await raceSafeUniqueEmail(db, 'taken@example.com', write);
    expect(result).toEqual({ ok: false });
    expect(write).not.toHaveBeenCalled();
  });

  it("proceeds to write when the only existing row is the caller's own (excludeId)", async () => {
    const db = fakeDb([{ id: 'member-1' }]);
    const write = jest.fn().mockResolvedValue('written');
    const result = await raceSafeUniqueEmail(
      db,
      'own@example.com',
      write,
      'member-1',
    );
    expect(result).toEqual({ ok: true, value: 'written' });
    expect(write).toHaveBeenCalled();
  });

  it('succeeds when no row exists and write resolves', async () => {
    const db = fakeDb([]);
    const write = jest.fn().mockResolvedValue('created');
    const result = await raceSafeUniqueEmail(db, 'new@example.com', write);
    expect(result).toEqual({ ok: true, value: 'created' });
  });

  it('fails when the precheck passed but write hits the unique index (TOCTOU race)', async () => {
    const db = fakeDb([]);
    const write = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('duplicate key'), { cause: { code: '23505' } }),
      );
    const result = await raceSafeUniqueEmail(db, 'raced@example.com', write);
    expect(result).toEqual({ ok: false });
  });

  it('rethrows a write failure unrelated to the unique index', async () => {
    const db = fakeDb([]);
    const write = jest.fn().mockRejectedValue(new Error('connection lost'));
    await expect(
      raceSafeUniqueEmail(db, 'x@example.com', write),
    ).rejects.toThrow('connection lost');
  });
});
