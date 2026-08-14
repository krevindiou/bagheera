import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Production runs behind Caddy (TLS-terminating reverse proxy, see
  // docker-compose.prod.yml); trust its X-Forwarded-* headers so
  // req.secure reflects the original HTTPS request and Secure cookies work.
  app.set('trust proxy', 1);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
