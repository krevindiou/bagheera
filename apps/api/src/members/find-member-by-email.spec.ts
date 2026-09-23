import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { findMemberByEmail } from './find-member-by-email';

function fakeDb(rows: unknown[]): NodePgDatabase {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(rows),
      }),
    }),
  } as unknown as NodePgDatabase;
}

describe('findMemberByEmail', () => {
  it('returns the member holding the address', async () => {
    const row = { id: 'member-1', email: 'Member@Example.test', locale: 'fr' };
    await expect(findMemberByEmail(fakeDb([row]), 'member@example.test')).resolves.toEqual(row);
  });

  it('returns undefined when nobody holds it', async () => {
    await expect(findMemberByEmail(fakeDb([]), 'new@example.test')).resolves.toBeUndefined();
  });
});
