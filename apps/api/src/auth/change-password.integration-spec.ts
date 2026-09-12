import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

describe('POST /auth/change-password', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('changes the password when the current one is correct and confirmation matches', async () => {
    const { agent, getCsrfToken, email, password } = await seedSignedInMember(app);
    const newPassword = 'a-brand-new-password-1';

    const csrfToken1 = await getCsrfToken();
    await agent
      .post('/auth/change-password')
      .set('x-csrf-token', csrfToken1)
      .send({
        currentPassword: password,
        newPassword,
        newPasswordConfirmation: newPassword,
      })
      .expect(200);

    // Old password no longer works; new one does.
    const freshAgent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(freshAgent);
    await freshAgent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(401);

    const anotherAgent = request.agent(app.getHttpServer());
    const anotherCsrfToken = await csrfTokenFor(anotherAgent);
    await anotherAgent
      .post('/auth/sign-in')
      .set('x-csrf-token', anotherCsrfToken)
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('rejects a wrong current password and leaves the password unchanged', async () => {
    const { agent, getCsrfToken, email, password } = await seedSignedInMember(app);

    const csrfToken = await getCsrfToken();
    const res = await agent
      .post('/auth/change-password')
      .set('x-csrf-token', csrfToken)
      .send({
        currentPassword: 'totally-wrong',
        newPassword: 'whatever-new-1',
        newPasswordConfirmation: 'whatever-new-1',
      })
      .expect(400);
    expect((res.body as { message: string }).message).toBe('Current password is invalid.');

    const checkAgent = request.agent(app.getHttpServer());
    const checkCsrfToken = await csrfTokenFor(checkAgent);
    await checkAgent
      .post('/auth/sign-in')
      .set('x-csrf-token', checkCsrfToken)
      .send({ email, password })
      .expect(200);
  });

  it('rejects mismatched new password confirmation', async () => {
    const { agent, getCsrfToken, password } = await seedSignedInMember(app);

    const csrfToken = await getCsrfToken();
    const res = await agent
      .post('/auth/change-password')
      .set('x-csrf-token', csrfToken)
      .send({
        currentPassword: password,
        newPassword: 'one-new-password',
        newPasswordConfirmation: 'a-different-one',
      })
      .expect(400);
    expect((res.body as { message: string }).message).toBe("Passwords don't match.");
  });

  it('terminates every other session for the member but keeps the current one', async () => {
    const { agent: agent1, getCsrfToken, email, password } = await seedSignedInMember(app);

    // A second, independent session for the *same* member.
    const agent2 = request.agent(app.getHttpServer());
    const csrfToken2 = await csrfTokenFor(agent2);
    await agent2
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken2)
      .send({ email, password })
      .expect(200);
    await agent2.get('/auth/me').expect(200);

    const newPassword = 'yet-another-new-password-1';
    const csrfToken3 = await getCsrfToken();
    await agent1
      .post('/auth/change-password')
      .set('x-csrf-token', csrfToken3)
      .send({
        currentPassword: password,
        newPassword,
        newPasswordConfirmation: newPassword,
      })
      .expect(200);

    // agent1 (the one that made the change) is still authenticated...
    await agent1.get('/auth/me').expect(200);
    // ...agent2 (the other session) is not.
    await agent2.get('/auth/me').expect(401);
  });
});
