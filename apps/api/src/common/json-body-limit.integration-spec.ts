import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { Server } from 'http';
import request from 'supertest';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

// A body of the given size, with a key the import DTO does not know, which
// ValidationPipe strips rather than rejects.
const padded = (bytes: number) => ({ padding: 'x'.repeat(bytes) });
const paddedJson = (bytes: number) => JSON.stringify(padded(bytes));

describe('JSON body limits', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const importPreview = (importId = randomUUID()) => `/operations/import/${importId}/preview`;

  it('refuses a compressed JSON body on any route with 415, before any work', async () => {
    const gzipped = gzipSync(JSON.stringify({ padding: 'x'.repeat(200_000) }));

    const res = await request(app.getHttpServer())
      .post('/webauthn/authentication/options')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipped);

    expect(res.status).toBe(415);
  });

  it('gives a route other than import the 100 KB default, before CSRF', async () => {
    const res = await request(app.getHttpServer())
      .post('/webauthn/authentication/options')
      .set('Content-Type', 'application/json')
      .send(paddedJson(200_000));

    expect(res.status).toBe(413);
  });

  it('does not parse an anonymous 2 MB import body, even with a CSRF token', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrfTokenFor(agent);

    const res = await agent
      .post(importPreview())
      .set('x-csrf-token', token)
      .set('Content-Type', 'application/json')
      .send(paddedJson(1_500_000));

    // Past the 100 KB default and the parser, so it reaches the guard.
    expect(res.status).toBe(401);
  });

  it('gives a signed-in import body the 2 MB limit', async () => {
    const fixture = await seedSignedInMember(app);

    const res = await fixture.mutate('post', importPreview(), padded(300_000));

    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('still refuses a signed-in import body over 2 MB with 413', async () => {
    const fixture = await seedSignedInMember(app);

    const res = await fixture.mutate('post', importPreview(), padded(2_100_000));

    expect(res.status).toBe(413);
  });
});
