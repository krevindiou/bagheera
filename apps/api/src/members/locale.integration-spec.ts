import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member } from '../db/schema';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

describe('POST /members/locale', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("updates the signed-in member's locale, no password required", async () => {
    const { mutate, memberId } = await seedSignedInMember(app);

    const res = await mutate('post', '/members/locale', { locale: 'fr' });
    expect(res.status).toBe(200);

    const [row] = await getDb(app).select().from(member).where(eq(member.id, memberId));
    expect(row.locale).toBe('fr');
  });

  it('rejects an unsupported locale and leaves the stored one unchanged', async () => {
    const { mutate, memberId } = await seedSignedInMember(app);

    const res = await mutate('post', '/members/locale', { locale: 'de' });
    expect(res.status).toBe(400);

    const [row] = await getDb(app).select().from(member).where(eq(member.id, memberId));
    expect(row.locale).toBe('en');
  });

  it('rejects an unauthenticated request', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/locale')
      .set('x-csrf-token', csrfToken)
      .send({ locale: 'fr' })
      .expect(401);
  });
});
