import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import {
  insertAccount,
  insertBank,
  insertMember,
} from '../../test-support/db-fixtures';
import { bank } from './bank';
import { member } from './member';

describe('bank/account schema', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('bank.memberId FK', () => {
    it('rejects a bank pointing at a member that does not exist', async () => {
      await expect(insertBank(getDb(app), randomUUID())).rejects.toMatchObject({
        cause: { code: '23503' },
      });
    });

    it('accepts a bank pointing at a real member', async () => {
      const memberRow = await insertMember(getDb(app));
      const row = await insertBank(getDb(app), memberRow.id);
      expect(row.memberId).toBe(memberRow.id);
    });

    it('refuses to delete a member that still owns a bank (no cascade declared)', async () => {
      const memberRow = await insertMember(getDb(app));
      await insertBank(getDb(app), memberRow.id);

      await expect(
        getDb(app).delete(member).where(eq(member.id, memberRow.id)),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });
  });

  describe('account.bankId FK', () => {
    it('rejects an account pointing at a bank that does not exist', async () => {
      await expect(
        insertAccount(getDb(app), randomUUID()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('accepts an account pointing at a real bank', async () => {
      const memberRow = await insertMember(getDb(app));
      const bankRow = await insertBank(getDb(app), memberRow.id);
      const row = await insertAccount(getDb(app), bankRow.id);
      expect(row.bankId).toBe(bankRow.id);
    });

    it('refuses to delete a bank that still owns an account (no cascade declared)', async () => {
      const memberRow = await insertMember(getDb(app));
      const bankRow = await insertBank(getDb(app), memberRow.id);
      await insertAccount(getDb(app), bankRow.id);

      await expect(
        getDb(app).delete(bank).where(eq(bank.id, bankRow.id)),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });
  });
});
