import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { insertMemberBankAccount } from '../../test-support/db-fixtures';
import { labelCorrection } from './label-correction';

describe('label_correction schema', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const insert = (memberId: string, sourceLabel: string) =>
    getDb(app).insert(labelCorrection).values({ memberId, sourceLabel, thirdParty: 'Shop' });

  it('rejects a correction of a member that does not exist', async () => {
    await expect(insert(randomUUID(), 'LABEL')).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('allows one correction per label of the file for a member, ignoring case', async () => {
    const { member } = await insertMemberBankAccount(getDb(app));
    await insert(member.id, 'CB CARREFOUR');

    await expect(insert(member.id, 'cb carrefour')).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });

  it('lets two members correct the same label of the file', async () => {
    const first = await insertMemberBankAccount(getDb(app));
    const second = await insertMemberBankAccount(getDb(app));
    await insert(first.member.id, 'PRLV EDF');

    await expect(insert(second.member.id, 'PRLV EDF')).resolves.toBeDefined();
  });
});
