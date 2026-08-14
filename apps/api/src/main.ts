import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Bagheera API').setVersion('1').build(),
  );
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
