import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { initSentry } from './logging/sentry';

initSentry();

import { AppModule } from './app.module';
import { apiResponseHeaders } from './common/api-response-headers';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Every controller route lives under /api — one prefix both
  // docker/Caddyfile and apps/web/vite.config.ts's dev proxy can match with
  // a single /api* rule, instead of listing each controller's first path
  // segment by hand (see scripts/check-api-routes.mjs's removal). /health
  // stays unprefixed: Dockerfile.api's HEALTHCHECK and docker-compose.yml's
  // both curl it directly, unprefixed, and Kamal's proxy checks it too.
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // Production sits behind exactly ONE reverse-proxy hop: kamal-proxy,
  // routing straight to this app (see config/deploy.api.yml) — it no
  // longer passes through the Caddy container the web app runs (that was a
  // second, TLS-terminating-then-forwarding hop; api is its own Kamal app
  // now, proxied directly, not an accessory Caddy reverse_proxy'd to). A
  // wrong hop count here resolves req.ip to an intermediate proxy's own
  // address instead of the real client's, on every request — which
  // collapses RateLimitGuard's per-IP dimension (keyed on req.ip) into a
  // single bucket shared by the whole site, and corrupts every audit-log
  // source address. The count must match the real number of hops exactly.
  app.set('trust proxy', 1);
  // Baseline security headers (X-Frame-Options, X-Content-Type-Options,
  // HSTS, etc). CSP relaxed for 'unsafe-inline' script/style outside
  // production only, because Swagger UI (served from this same app at
  // /api/docs, and only mounted below when NODE_ENV !== 'production')
  // injects inline <script>/<style> tags; everything else stays
  // same-origin only. Production never mounts Swagger, so it gets the
  // strict policy with no 'unsafe-inline'.
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  app.use(apiResponseHeaders);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger UI/schema exposes the full route map — dev/staging convenience
  // only, never serve it in production (it's on the same reverse-proxied
  // origin as the real API, so there's no network boundary hiding it).
  if (!isProduction) {
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Bagheera API').setVersion('1').build(),
      // Keeps documented paths prefix-free (e.g. "/auth/csrf-token" rather
      // than "/api/auth/csrf-token") — apps/web/src/api/client.ts supplies
      // the /api prefix itself via openapi-fetch's own baseUrl, so the
      // generated schema.d.ts's path keys must match what's documented
      // here, not the real registered route.
      { ignoreGlobalPrefix: true },
    );
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
