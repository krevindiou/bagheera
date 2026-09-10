import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'http';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../app.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';

/**
 * Boots a real Nest application (real Postgres/Valkey — see
 * apps/api/test/integration-infra.ts — real guards/filters/pipes, real
 * services) for supertest to drive over HTTP, wired the same way
 * `main.ts` wires it before `app.listen()`. Deliberately skips
 * `main.ts`'s `helmet()`/`trust proxy`/robots-header/Swagger setup —
 * prod-hardening/docs concerns orthogonal to the business logic this
 * suite exercises, and `trust proxy`'s hop count assumes real reverse
 * proxies that don't exist in-process.
 *
 * Lives under src/test-support/ (alongside the unit suite's
 * fake-http-context.ts/test-crypto-service.ts) rather than
 * apps/api/test/ — it's imported by *.integration-spec.ts files, which
 * live under src/ and are covered by tsconfig.json's rootDir; anything
 * those specs import must live under src/ too, or `tsc -p tsconfig.json`
 * rejects it as outside rootDir. apps/api/test/ stays reserved for files
 * jest references only by path string (globalSetup/globalTeardown/
 * setupFilesAfterEach in jest-integration.json), never imported from src/.
 *
 * The one seam replaced: `EmailQueueService` is swapped for a fake so no
 * spec depends on a reachable SMTP server (see CLAUDE.md's "no local
 * runtime" — there's no Mailpit in the Testcontainers-only integration
 * environment). Every call is still recorded on `fakeEmailQueue.enqueue`
 * for specs that need to assert "an email got queued".
 *
 * The session and CSRF cookies are both hardcoded `secure: true`
 * (session.module.ts, csrf.ts) — correct for production, and for real
 * browsers hitting local dev too (Chrome/Firefox both treat `localhost`
 * as a secure context even over plain http, same carve-out noted for
 * RP_ORIGIN in .env.example). Neither side of that carve-out exists for
 * an in-process supertest server, which breaks the session/CSRF cookie
 * round trip this whole suite depends on, two different ways:
 *
 * 1. `express-session` itself refuses to ever emit its Set-Cookie header
 *    when `cookie.secure` is true but the *request* wasn't received
 *    securely (checked via `req.secure`, which — with no `trust proxy`
 *    configured here, deliberately, see above — is always false on a
 *    plain http.Server). Confirmed by inspecting express-session's
 *    source (`issecure()` in its onHeaders callback): the session *does*
 *    get saved to the store either way, it just never tells the client
 *    about it. Fixed by forcing `req.secure = true` before session
 *    middleware ever reads it.
 * 2. Separately, supertest's bundled cookie jar (`cookiejar`) has no
 *    localhost carve-out of its own: once a `Secure` cookie *is* set (as
 *    csrf-csrf's own cookie already was, unaffected by #1's fix — that's
 *    a plain `res.cookie()` call with no such runtime check), the jar
 *    still refuses to resend it on the next request, since every
 *    in-process request is plain http. Fixed by stripping the `Secure`
 *    attribute from outgoing Set-Cookie headers.
 *
 * Both are test-harness-only compensations — nothing about how the real
 * app sets or checks cookies outside this harness changes.
 */
function fixSecureCookiesForPlainHttp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
  enqueue: jest.Mock<Promise<void>, [unknown]>;
}

export interface TestApp {
  app: INestApplication<Server>;
  fakeEmailQueue: FakeEmailQueue;
}

export async function createTestApp(): Promise<TestApp> {
  const fakeEmailQueue: FakeEmailQueue = {
    enqueue: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailQueueService)
    .useValue(fakeEmailQueue)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  // Without this, Nest's internal Logger (GlobalExceptionFilter's own
  // error log, AuditService's best-effort-write log, etc.) falls back to
  // Nest's default console logger instead of the app's real pino instance
  // — invisible to LOG_LEVEL, so it can't be quieted the way
  // integration-infra.ts quiets pino-http's per-request logging.
  app.useLogger(app.get(Logger));
  // Registered before app.init() so it sits ahead of SessionModule's own
  // middleware (applied during init) on the Express stack — it must run
  // before session middleware reads req.secure, and wrap res.setHeader
  // before session/csrf-csrf ever call it.
  app.use(fixSecureCookiesForPlainHttp);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, fakeEmailQueue };
}

/** The same Drizzle instance the running app uses — for fixture setup and asserting persisted state directly. */
export function getDb(
  app: INestApplication<Server>,
): NodePgDatabase<typeof schema> {
  return app.get(DRIZZLE);
}
