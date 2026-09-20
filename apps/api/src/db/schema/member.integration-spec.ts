import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { uniqueEmail } from '../../test-support/auth-fixture';
import { insertMember } from '../../test-support/db-fixtures';

describe('member schema', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('email uniqueness (case-insensitive)', () => {
    it('rejects a second member with the exact same email', async () => {
      const email = uniqueEmail();
      await insertMember(getDb(app), { email });

      await expect(insertMember(getDb(app), { email })).rejects.toMatchObject({
        cause: { code: '23505' },
      });
    });

    it('rejects a second member whose email only differs by case', async () => {
      const email = uniqueEmail();
      await insertMember(getDb(app), { email });

      await expect(insertMember(getDb(app), { email: email.toUpperCase() })).rejects.toMatchObject({
        cause: { code: '23505' },
      });
    });

    it('allows two members with genuinely distinct emails', async () => {
      const first = await insertMember(getDb(app));
      const second = await insertMember(getDb(app));

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('defaults on a minimal insert', () => {
    it('sets a zero-token-version member with no pending email', async () => {
      const row = await insertMember(getDb(app));

      expect(row.emailChangeTokenVersion).toBe(0);
      expect(row.pendingEmail).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
    });
  });
});
