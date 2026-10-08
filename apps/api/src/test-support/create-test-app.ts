import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'http';
import { Logger } from 'nestjs-pino';
import { vi, type Mock } from 'vitest';
import { AppModule } from '../app.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';

/**
 * Makes the `secure: true` session/CSRF cookies work over in-process plain
 * http (test harness only):
 *
 * 1. express-session never sends a Secure cookie on a request that isn't
 *    `req.secure`, so that's forced true.
 * 2. supertest's cookie jar never resends a Secure cookie over http, so
 *    `Secure` is stripped from outgoing Set-Cookie headers.
 */
function fixSecureCookiesForPlainHttp(req: Request, res: Response, next: NextFunction): void {
  Object.defineProperty(req, 'secure', { value: true, configurable: true });

  const originalSetHeader = res.setHeader.bind(res) as (
    name: string,
    value: number | string | string[],
  ) => Response;
  res.setHeader = ((name: string, value: number | string | string[]) => {
    if (name.toLowerCase() === 'set-cookie') {
      const strip = (v: string) => v.replace(/;\s*Secure/gi, '');
      value = Array.isArray(value) ? value.map(strip) : strip(String(value));
    }
    return originalSetHeader(name, value);
  }) as Response['setHeader'];
  next();
}

export interface FakeEmailQueue {
  enqueue: Mock<(message: unknown) => Promise<void>>;
  /** Only recorded: nothing runs SignupRequestService here — call it directly. */
  enqueueSignupRequest: Mock<(message: unknown) => Promise<void>>;
}

export interface TestApp {
  app: INestApplication<Server>;
  fakeEmailQueue: FakeEmailQueue;
}

/**
 * Boots the real app (Testcontainers Postgres/Valkey) wired like main.ts,
 * minus helmet, `trust proxy`, apiResponseHeaders, the /api prefix and
 * Swagger, with
 * EmailQueueService replaced by a recording fake.
 */
export async function createTestApp(): Promise<TestApp> {
  const fakeEmailQueue: FakeEmailQueue = {
    enqueue: vi.fn<(message: unknown) => Promise<void>>().mockResolvedValue(undefined),
    enqueueSignupRequest: vi.fn<(message: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailQueueService)
    .useValue(fakeEmailQueue)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  // So Nest's Logger goes through pino and LOG_LEVEL can quiet it.
  app.useLogger(app.get(Logger));
  // Before app.init(), so it runs ahead of SessionModule's middleware.
  app.use(fixSecureCookiesForPlainHttp);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, fakeEmailQueue };
}

/** The same Drizzle instance the running app uses — for fixture setup and asserting persisted state directly. */
export function getDb(app: INestApplication<Server>): NodePgDatabase<typeof schema> {
  return app.get(DRIZZLE);
}
