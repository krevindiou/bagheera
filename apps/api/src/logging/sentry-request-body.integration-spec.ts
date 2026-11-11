import { randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';
import { INestApplication, Logger } from '@nestjs/common';
import type { Server } from 'http';
import { pino } from 'pino';
import { bank } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { ImportStore } from '../operations/import/import.store';
import { OperationService } from '../operations/operation.service';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { categoryIdOfType } from '../test-support/db-fixtures';
import { bankFile, createAccount, upload } from '../test-support/import-fixtures';
import { initSentry, Sentry } from './sentry';

interface SentryEvent {
  exception?: unknown;
  request?: { url?: string; data?: unknown };
}

// Built at run time: Sentry attaches source context lines to stack frames,
// and a literal marker in this file could turn up there.
const newMarker = () => `content-marker-${randomUUID()}`;

describe('What the API sends to Sentry', () => {
  let app: INestApplication<Server>;
  let ingest: HttpServer;
  let envelopes: string[] = [];
  const originalDsn = process.env.SENTRY_DSN;

  beforeAll(async () => {
    ingest = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        envelopes.push(
          (req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString('utf8'),
        );
        res.writeHead(200).end('{}');
      });
    });
    await new Promise<void>((resolve) => ingest.listen(0, '127.0.0.1', resolve));
    const { port } = ingest.address() as AddressInfo;

    process.env.SENTRY_DSN = `http://key@127.0.0.1:${port}/1`;
    initSentry();
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
    await Sentry.close();
    await new Promise<void>((resolve) => ingest.close(() => resolve()));
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  beforeEach(() => {
    envelopes = [];
  });

  // An envelope is newline-delimited JSON: a header, then an item header and
  // its payload for each item.
  async function reportedErrors(): Promise<{
    events: SentryEvent[];
    itemTypes: Set<string | undefined>;
    raw: string;
  }> {
    await Sentry.flush(5000);
    const events: SentryEvent[] = [];
    const itemTypes = new Set<string | undefined>();
    for (const envelope of envelopes) {
      const lines = envelope.split('\n').filter((line) => line !== '');
      for (let i = 1; i < lines.length - 1; i += 2) {
        const { type } = JSON.parse(lines[i]) as { type?: string };
        itemTypes.add(type);
        if (type === 'event') {
          events.push(JSON.parse(lines[i + 1]) as SentryEvent);
        }
      }
    }
    return { events, itemTypes, raw: envelopes.join('\n') };
  }

  it('traces a request without its query string, client address or Valkey command arguments', async () => {
    const fixture = await seedSignedInMember(app);
    const marker = newMarker();
    const clientAddress = '203.0.113.79';

    const res = await fixture.agent
      .get('/operations/autocomplete')
      .set('x-forwarded-for', clientAddress)
      .query({ q: marker });
    expect(res.status).toBe(200);

    const { itemTypes, raw } = await reportedErrors();
    expect(itemTypes).toContain('span');
    // The session lookup was traced, so its key had a chance to leak.
    expect(raw).toContain('"redis"');
    expect(raw).not.toContain('sess:');
    expect(raw).not.toContain(marker);
    expect(raw).not.toContain(clientAddress);
  });

  it('sends a pino line as a log with only the request path', async () => {
    const marker = newMarker();
    const clientAddress = '203.0.113.80';
    const logger = pino({ level: 'info' }, { write: () => undefined });

    logger.info(
      {
        req: {
          method: 'GET',
          url: `/api/operations/autocomplete?q=${marker}`,
          query: { q: marker },
          headers: { 'x-forwarded-for': clientAddress },
          remoteAddress: clientAddress,
        },
      },
      'request completed',
    );

    const { itemTypes, raw } = await reportedErrors();
    expect(itemTypes).toContain('log');
    expect(raw).toContain('/api/operations/autocomplete');
    expect(raw).not.toContain(marker);
    expect(raw).not.toContain(clientAddress);
  });

  it('leaves a JSON request body out of the event', async () => {
    const fixture = await seedSignedInMember(app);
    const accountId = await createAccount(fixture);
    const marker = newMarker();
    // Not a real database failure, so only the request body carries the marker.
    vi.spyOn(app.get(OperationService), 'create').mockRejectedValueOnce(new Error('db down'));

    const res = await fixture.mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Grocery store',
      amount: 10,
      categoryId: await categoryIdOfType(getDb(app), 'debit'),
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      notes: marker,
    });
    expect(res.status).toBe(500);

    const { events, raw } = await reportedErrors();
    expect(events).toHaveLength(1);
    expect(events[0].exception).toBeDefined();
    expect(events[0].request?.url).toMatch(/\/operations$/);
    expect(events[0].request?.data).toBeUndefined();
    expect(raw).not.toContain(marker);
  });

  it('leaves an uploaded bank file out of the event', async () => {
    const fixture = await seedSignedInMember(app);
    const accountId = await createAccount(fixture);
    const marker = newMarker();
    vi.spyOn(app.get(ImportStore), 'save').mockRejectedValueOnce(new Error('store down'));

    const res = await upload(
      fixture,
      accountId,
      bankFile(`Date;Amount;Label\n05/03/2026;-12,50;${marker}`),
    );
    expect(res.status).toBe(500);

    const { events, raw } = await reportedErrors();
    expect(events).toHaveLength(1);
    expect(events[0].exception).toBeDefined();
    expect(events[0].request?.url).toMatch(/\/operations\/import$/);
    expect(events[0].request?.data).toBeUndefined();
    expect(raw).not.toContain(marker);
  });

  it('leaves the values of a rejected query out of the log line and the event', async () => {
    const fixture = await seedSignedInMember(app);
    const accountId = await createAccount(fixture);
    // Short enough for the bank name column.
    const marker = newMarker().slice(0, 30);
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    // A foreign key violation: the insert fails with the marker as a bound value.
    vi.spyOn(app.get(OperationService), 'create').mockImplementationOnce(async () => {
      await getDb(app).insert(bank).values({ memberId: randomUUID(), name: marker });
      throw new Error('unreachable');
    });

    const res = await fixture.mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Grocery store',
      amount: 10,
      categoryId: await categoryIdOfType(getDb(app), 'debit'),
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    });
    expect(res.status).toBe(500);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0][0])).toContain('query failed (23503)');
    expect(JSON.stringify(logged.mock.calls)).not.toContain(marker);
    const { events, raw } = await reportedErrors();
    expect(events).toHaveLength(1);
    expect(raw).toContain('query failed (23503)');
    expect(raw).not.toContain(marker);
    logged.mockRestore();
  });
});
