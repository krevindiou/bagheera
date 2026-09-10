import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

describe('GET /auth/me', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the signed-in member's email", async () => {
    const { agent, email } = await seedSignedInMember(app);
    const res = await agent.get('/auth/me').expect(200);
    expect(res.body).toEqual({ email });
  });

  it('rejects an unauthenticated request', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/auth/me').expect(401);
  });

  it('rejects a session whose member row no longer exists', async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);

    // sign-in leaves a sign_in_success security_event row referencing this
    // member (see db/schema/security-event.integration-spec.ts's own FK
    // test) — clear it first, or the delete below hits that real
    // constraint instead of exercising what this test is actually about.
    const db = getDb(app);
    await db.delete(securityEvent).where(eq(securityEvent.memberId, memberId));
    await db.delete(member).where(eq(member.id, memberId));

    await agent.get('/auth/me').expect(401);
  });
});
