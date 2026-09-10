import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

describe('POST /auth/sign-out', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('destroys the session server-side — the same cookie no longer authenticates', async () => {
    const { agent, getCsrfToken } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);

    // Resolve before .post() — see getCsrfToken's doc comment.
    const csrfToken = await getCsrfToken();
    await agent
      .post('/auth/sign-out')
      .set('x-csrf-token', csrfToken)
      .expect(200);

    await agent.get('/auth/me').expect(401);
  });

  it('succeeds even when nothing was ever signed in', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    await agent
      .post('/auth/sign-out')
      .set('x-csrf-token', csrfToken)
      .expect(200);
  });
});
