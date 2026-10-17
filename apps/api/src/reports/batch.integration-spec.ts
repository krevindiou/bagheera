import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import { report, securityEvent } from '../db/schema';
import { SecurityEventType } from '../security/audit.service';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

async function countEvents(
  app: INestApplication<Server>,
  eventType: SecurityEventType,
  memberId: string,
): Promise<number> {
  const rows = await getDb(app)
    .select()
    .from(securityEvent)
    .where(and(eq(securityEvent.eventType, eventType), eq(securityEvent.memberId, memberId)));
  return rows.length;
}

describe('POST /reports/batch/delete', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes only owned ids and records report_batch_deleted', async () => {
    const { mutate, memberId } = await seedSignedInMember(app);
    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'Mine',
      periodGrouping: 'month',
    });
    const { id: ownId } = (created.body as { report: { id: string } }).report;

    const { mutate: otherMutate } = await seedSignedInMember(app);
    const foreignCreated = await otherMutate('post', '/reports', {
      type: 'sum',
      title: 'Not mine',
      periodGrouping: 'month',
    });
    const { id: foreignId } = (foreignCreated.body as { report: { id: string } }).report;

    const res = await mutate('post', '/reports/batch/delete', {
      ids: [ownId, foreignId],
    });
    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const ownRows = await getDb(app).select().from(report).where(eq(report.id, ownId));
    expect(ownRows).toHaveLength(0);
    const foreignRows = await getDb(app).select().from(report).where(eq(report.id, foreignId));
    expect(foreignRows).toHaveLength(1);

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.eventType, 'report_batch_deleted'),
          eq(securityEvent.memberId, memberId),
        ),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
  });

  it('records no event when every id is foreign or unknown', async () => {
    const { mutate, memberId } = await seedSignedInMember(app);
    const { mutate: otherMutate } = await seedSignedInMember(app);
    const foreignCreated = await otherMutate('post', '/reports', {
      type: 'sum',
      title: 'Not mine',
      periodGrouping: 'month',
    });
    const { id: foreignId } = (foreignCreated.body as { report: { id: string } }).report;

    const res = await mutate('post', '/reports/batch/delete', {
      ids: [foreignId, '01900000-0000-7000-8000-000000000000'],
    });
    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(0);
    expect(await countEvents(app, 'report_batch_deleted', memberId)).toBe(0);

    const foreignRows = await getDb(app).select().from(report).where(eq(report.id, foreignId));
    expect(foreignRows).toHaveLength(1);
  });
});
