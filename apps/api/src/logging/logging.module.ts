import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { LOG_REDACT_PATHS } from './redact-paths';

/**
 * JSON logs on stdout; pretty-printed when LOG_PRETTY=true (start:dev).
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
          paths: LOG_REDACT_PATHS,
          remove: true,
        },
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
  ],
})
export class LoggingModule {}
