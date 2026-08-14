import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

/**
 * Structured JSON logging on stdout, for `docker compose logs`/any log
 * shipper. Pretty-prints in dev (LOG_PRETTY=true, set by the api's own
 * start:dev script) so local output stays readable; production leaves it as
 * plain JSON lines.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.LOG_PRETTY === 'true'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
  ],
})
export class LoggingModule {}
