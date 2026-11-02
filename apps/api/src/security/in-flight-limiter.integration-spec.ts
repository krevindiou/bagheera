import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { createTestApp } from '../test-support/create-test-app';
import { InFlightLimiter } from './in-flight-limiter';

describe('InFlightLimiter (Valkey)', () => {
  let app: INestApplication<Server>;
  let limiter: InFlightLimiter;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    limiter = app.get(InFlightLimiter);
  });

  afterAll(async () => {
    await app.close();
  });

  const limit = { max: 2, slotTtlMs: 60_000 };

  it('hands out at most `max` slots per key, and frees one on release', async () => {
    const key = `test:${randomUUID()}`;

    const first = await limiter.acquire(key, limit);
    const second = await limiter.acquire(key, limit);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(await limiter.acquire(key, limit)).toBeNull();

    await limiter.release(key, first!);
    expect(await limiter.acquire(key, limit)).not.toBeNull();
  });

  it('keeps each key apart', async () => {
    const key = `test:${randomUUID()}`;
    await limiter.acquire(key, limit);
    await limiter.acquire(key, limit);

    expect(await limiter.acquire(`test:${randomUUID()}`, limit)).not.toBeNull();
  });

  it('frees a slot never released once its TTL has passed', async () => {
    const key = `test:${randomUUID()}`;
    const shortLived = { max: 1, slotTtlMs: 200 };
    expect(await limiter.acquire(key, shortLived)).not.toBeNull();
    expect(await limiter.acquire(key, shortLived)).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await limiter.acquire(key, shortLived)).not.toBeNull();
  });

  it('ignores a release with a token that holds no slot', async () => {
    const key = `test:${randomUUID()}`;
    const held = { max: 1, slotTtlMs: 60_000 };
    expect(await limiter.acquire(key, held)).not.toBeNull();

    await limiter.release(key, randomUUID());
    expect(await limiter.acquire(key, held)).toBeNull();
  });
});
