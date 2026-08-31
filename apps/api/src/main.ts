import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { initSentry } from './logging/sentry';

initSentry();

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Production runs behind Caddy (TLS-terminating reverse proxy, see
  // docker-compose.prod.yml); trust its X-Forwarded-* headers so
  // req.secure reflects the original HTTPS request and Secure cookies work.
  app.set('trust proxy', 1);
  // Baseline security headers (X-Frame-Options, X-Content-Type-Options,
  // HSTS, etc). CSP relaxed for 'unsafe-inline' script/style because
  // Swagger UI (served from this same app at /api/docs) injects inline
  // <script>/<style> tags; everything else stays same-origin only.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  // Ask crawlers not to index API responses (spec section 7).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger UI/schema exposes the full route map — dev/staging convenience
  // only, never serve it in production (it's on the same reverse-proxied
  // origin as the real API, so there's no network boundary hiding it).
  if (process.env.NODE_ENV !== 'production') {
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Bagheera API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
