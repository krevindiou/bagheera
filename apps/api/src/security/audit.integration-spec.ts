import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent } from '../db/schema';
import { AuditService, SecurityEventType } from './audit.service';
import {
  csrfTokenFor,
  insertActiveMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

describe('security audit log', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('records the real source address and the resolved member on a known-member failure', async () => {
    const { email, memberId } = await insertActiveMember(app);
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password: 'wrong-password-1' })
      .expect(401);

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.eventType, 'sign_in_failure'),
          eq(securityEvent.memberId, memberId),
        ),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
    expect(event.sourceAddress.length).toBeGreaterThan(0);
  });

  it('records a null memberId for a failure against an unknown email', async () => {
    const email = uniqueEmail('nobody-audited');
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password: 'whatever12' })
      .expect(401);

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.eventType, 'sign_in_failure'),
          isNull(securityEvent.memberId),
        ),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
  });

  it('is best-effort: a write that violates the schema is swallowed, not thrown', async () => {
    const audit = app.get(AuditService);
    await expect(
      audit.record(
        'not_a_real_event_type' as SecurityEventType,
        null,
        '127.0.0.1',
      ),
    ).resolves.toBeUndefined();
  });
});
