import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

describe('reference-data', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the seeded categories, including Salary', async () => {
    const { agent } = await seedSignedInMember(app);
    const res = await agent.get('/reference-data/categories').expect(200);
    const body = res.body as { name: string }[];
    expect(body.some((c) => c.name === 'Salary')).toBe(true);
  });

  it('lists every seeded payment method', async () => {
    const { agent } = await seedSignedInMember(app);
    const res = await agent.get('/reference-data/payment-methods').expect(200);
    const body = res.body as { id: string }[];
    expect(body).toHaveLength(Object.keys(PAYMENT_METHOD_ID).length);
  });

  it('requires authentication for both lists', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/reference-data/categories').expect(401);
    await agent.get('/reference-data/payment-methods').expect(401);
  });
});
