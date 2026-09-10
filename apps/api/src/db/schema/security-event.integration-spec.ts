import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { insertMember } from '../../test-support/db-fixtures';
import * as schema from './index';
import { securityEvent } from './security-event';

type Db = NodePgDatabase<typeof schema>;

function insertSecurityEvent(
  db: Db,
  overrides: Partial<typeof securityEvent.$inferInsert> = {},
) {
  return db
    .insert(securityEvent)
    .values({
      eventType: 'sign_in_success',
      sourceAddress: '127.0.0.1',
      ...overrides,
    })
    .returning();
}

describe('security_event schema', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('memberId (nullable — some events have no resolvable member)', () => {
    it('accepts a null memberId', async () => {
      const [row] = await insertSecurityEvent(getDb(app), {
        memberId: null,
      });
      expect(row.memberId).toBeNull();
    });

    it('rejects a memberId pointing at a member that does not exist', async () => {
      await expect(
        insertSecurityEvent(getDb(app), { memberId: randomUUID() }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('accepts a memberId pointing at a real member', async () => {
      const member = await insertMember(getDb(app));
      const [row] = await insertSecurityEvent(getDb(app), {
        memberId: member.id,
      });
      expect(row.memberId).toBe(member.id);
    });
  });

  describe('eventType enum', () => {
    it('rejects a value outside the security_event_type enum', async () => {
      await expect(
        insertSecurityEvent(getDb(app), {
          eventType: 'not_a_real_event',
        } as unknown as Partial<typeof securityEvent.$inferInsert>),
      ).rejects.toMatchObject({ cause: { code: '22P02' } });
    });
  });
});
