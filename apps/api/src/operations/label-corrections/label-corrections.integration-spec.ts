import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { labelCorrection, securityEvent } from '../../db/schema';
import { csrfTokenFor, seedSignedInMember } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';

describe('label corrections', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function insertCorrection(
    memberId: string,
    sourceLabel: string,
    thirdParty: string,
  ): Promise<string> {
    const [row] = await getDb(app)
      .insert(labelCorrection)
      .values({ memberId, sourceLabel, thirdParty })
      .returning({ id: labelCorrection.id });
    return row.id;
  }

  async function countDeletionEvents(memberId: string): Promise<number> {
    const rows = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.eventType, 'label_corrections_deleted'),
          eq(securityEvent.memberId, memberId),
        ),
      );
    return rows.length;
  }

  describe('GET /label-corrections', () => {
    it('rejects a request without a session', async () => {
      await request(app.getHttpServer()).get('/label-corrections').expect(401);
    });

    it("lists only the member's corrections, ordered by label ignoring case, with the limit", async () => {
      const { agent, memberId } = await seedSignedInMember(app);
      const other = await seedSignedInMember(app);
      const beta = await insertCorrection(memberId, 'b label', 'Beta');
      const alpha = await insertCorrection(memberId, 'A LABEL', 'Alpha');
      await insertCorrection(other.memberId, 'C LABEL', 'Gamma');

      const res = await agent.get('/label-corrections').expect(200);

      expect(res.body).toEqual({
        items: [
          { id: alpha, sourceLabel: 'A LABEL', thirdParty: 'Alpha' },
          { id: beta, sourceLabel: 'b label', thirdParty: 'Beta' },
        ],
        limit: IMPORT_LIMITS.MAX_LABEL_CORRECTIONS,
      });
    });
  });

  describe('POST /label-corrections/delete', () => {
    it('deletes the given corrections and audits it', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);
      const first = await insertCorrection(memberId, 'ONE', 'One');
      const second = await insertCorrection(memberId, 'TWO', 'Two');
      const kept = await insertCorrection(memberId, 'THREE', 'Three');

      const res = await mutate('post', '/label-corrections/delete', { ids: [first, second] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Label corrections deleted', deletedCount: 2 });
      const left = await getDb(app)
        .select({ id: labelCorrection.id })
        .from(labelCorrection)
        .where(eq(labelCorrection.memberId, memberId));
      expect(left).toEqual([{ id: kept }]);
      expect(await countDeletionEvents(memberId)).toBe(1);
    });

    it("drops another member's and unknown ids silently, without auditing", async () => {
      const { mutate, memberId } = await seedSignedInMember(app);
      const other = await seedSignedInMember(app);
      const foreign = await insertCorrection(other.memberId, 'FOREIGN', 'Foreign');
      const unknown = await getDb(app).execute<{ id: string }>(sql`select uuidv7() as id`);

      const res = await mutate('post', '/label-corrections/delete', {
        ids: [foreign, unknown.rows[0].id],
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deletedCount: 0 });
      const rows = await getDb(app)
        .select({ id: labelCorrection.id })
        .from(labelCorrection)
        .where(eq(labelCorrection.id, foreign));
      expect(rows).toHaveLength(1);
      expect(await countDeletionEvents(memberId)).toBe(0);
    });

    it('rejects a request without a session', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent
        .post('/label-corrections/delete')
        .set('x-csrf-token', csrfToken)
        .send({ ids: [] })
        .expect(401);
    });

    it('rejects an empty or malformed list of ids', async () => {
      const { mutate } = await seedSignedInMember(app);

      expect((await mutate('post', '/label-corrections/delete', { ids: [] })).status).toBe(400);
      expect(
        (await mutate('post', '/label-corrections/delete', { ids: ['not-a-uuid'] })).status,
      ).toBe(400);
    });
  });
});
