import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import { bank, securityEvent } from '../db/schema';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

function messageOf(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

describe('banks', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /banks', () => {
    it('starts empty for a fresh member', async () => {
      const { agent } = await seedSignedInMember(app);
      const res = await agent.get('/banks').expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /banks/choice', () => {
    it('creates a new bank when given a name', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);

      const res = await mutate('post', '/banks/choice', { name: 'My Bank' });
      expect(res.status).toBe(200);
      const body = res.body as { id: string; name: string; created: boolean };
      expect(body.created).toBe(true);
      expect(body.name).toBe('My Bank');

      const [row] = await getDb(app)
        .select()
        .from(bank)
        .where(eq(bank.id, body.id));
      expect(row.memberId).toBe(memberId);
    });

    it('chooses an existing owned bank without creating a duplicate', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'Existing Bank',
      });
      const { id } = created.body as { id: string };

      const res = await mutate('post', '/banks/choice', { bankId: id });
      expect(res.status).toBe(200);
      const body = res.body as { id: string; created: boolean };
      expect(body.created).toBe(false);
      expect(body.id).toBe(id);
    });

    it('rejects specifying both bankId and name', async () => {
      const { mutate } = await seedSignedInMember(app);

      const res = await mutate('post', '/banks/choice', {
        bankId: '00000000-0000-7000-8000-000000000001',
        name: 'X',
      });
      expect(res.status).toBe(400);
    });

    it('rejects specifying neither bankId nor name', async () => {
      const { mutate } = await seedSignedInMember(app);

      const res = await mutate('post', '/banks/choice', {});
      expect(res.status).toBe(400);
    });

    it("404s choosing another member's bank", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const created = await ownerMutate('post', '/banks/choice', {
        name: "Owner's bank",
      });
      const { id } = created.body as { id: string };

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate('post', '/banks/choice', {
        bankId: id,
      });
      expect(res.status).toBe(404);
    });

    it('rejects choosing a closed bank', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'To close',
      });
      const { id } = created.body as { id: string };
      await mutate('post', `/banks/${id}/close`);

      const res = await mutate('post', '/banks/choice', { bankId: id });
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /banks/:id', () => {
    it('renames an owned bank', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'Old name',
      });
      const { id } = created.body as { id: string };

      const res = await mutate('patch', `/banks/${id}`, { name: 'New name' });
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Bank saved');

      const [row] = await getDb(app).select().from(bank).where(eq(bank.id, id));
      expect(row.name).toBe('New name');
    });

    it("404s updating another member's bank", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const created = await ownerMutate('post', '/banks/choice', {
        name: "Owner's bank",
      });
      const { id } = created.body as { id: string };

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate('patch', `/banks/${id}`, {
        name: 'Hijacked',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /banks/:id/close and DELETE /banks/:id', () => {
    it('closes a bank (still listed) and records bank_closed', async () => {
      const { agent, mutate, memberId } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'To close',
      });
      const { id } = created.body as { id: string };

      const res = await mutate('post', `/banks/${id}/close`);
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Bank closed');

      const [row] = await getDb(app).select().from(bank).where(eq(bank.id, id));
      expect(row.closed).toBe(true);

      // Closed stays reachable/listable — never folded into ownership checks.
      const list = await agent.get('/banks').expect(200);
      expect((list.body as { id: string }[]).some((b) => b.id === id)).toBe(
        true,
      );

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'bank_closed'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('deletes a bank (no longer listed) and records bank_deleted', async () => {
      const { agent, mutate, memberId } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'To delete',
      });
      const { id } = created.body as { id: string };

      const res = await mutate('delete', `/banks/${id}`);
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Bank deleted');

      const [row] = await getDb(app).select().from(bank).where(eq(bank.id, id));
      expect(row.deleted).toBe(true);

      const list = await agent.get('/banks').expect(200);
      expect((list.body as { id: string }[]).some((b) => b.id === id)).toBe(
        false,
      );

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'bank_deleted'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('rejects deleting an already-deleted bank', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate('post', '/banks/choice', {
        name: 'Double delete',
      });
      const { id } = created.body as { id: string };
      await mutate('delete', `/banks/${id}`);

      const res = await mutate('delete', `/banks/${id}`);
      expect(res.status).toBe(422);
    });
  });
});
