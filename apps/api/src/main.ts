import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { initSentry } from './logging/sentry';

initSentry();

import { AppModule } from './app.module';
import { apiResponseHeaders } from './common/api-response-headers';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { useJsonBodyLimit } from './common/json-body-limit';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Without it SIGTERM (every Kamal deploy) kills the process before the
  // Express adapter drains in-flight requests and the modules'
  // OnModuleDestroy hooks close the pg pool, Valkey and BullMQ workers.
  app.enableShutdownHooks();
  // One /api prefix for the proxies (Caddy, Vite dev) to match. /health
  // stays bare for the Dockerfile/compose healthchecks and kamal-proxy.
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // Exactly one proxy hop in production: kamal-proxy (config/deploy.api.yml).
  // A wrong count makes req.ip a proxy's address, collapsing per-IP rate
  // limits into one site-wide bucket and corrupting audit-log addresses.
  app.set('trust proxy', 1);
  // 'unsafe-inline' outside production only, for Swagger UI's inline
  // <script>/<style>; production never mounts Swagger.
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
  // BREACH: the only secret in a body is the CSRF token, which is random per
  // mint and sits beside no reflected input, so its length leaks nothing.
  app.use(compression());
  useJsonBodyLimit(app);
  app.use(apiResponseHeaders);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger exposes the full route map: never in production.
  if (!isProduction) {
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Bagheera API').setVersion('1').build(),
      // Documented paths stay prefix-free: the web client adds /api via
      // openapi-fetch's baseUrl.
      { ignoreGlobalPrefix: true },
    );
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
