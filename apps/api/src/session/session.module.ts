import {
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import type { RedisClientType } from 'redis';
import { absoluteSessionTtl } from './absolute-session-ttl.middleware';
import { buildCsrf } from './csrf';
import { SessionRotationService } from './session-rotation.service';
import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SECONDS,
  VALKEY_CLIENT,
} from './session.constants';
import { valkeyClientProvider } from './valkey-client.provider';

@Module({
  imports: [ConfigModule],
  providers: [valkeyClientProvider, SessionRotationService],
  exports: [SessionRotationService, VALKEY_CLIENT],
})
export class SessionModule implements NestModule, OnModuleDestroy {
  constructor(
    @Inject(VALKEY_CLIENT) private readonly valkeyClient: RedisClientType,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.valkeyClient.quit();
  }

  configure(consumer: MiddlewareConsumer): void {
    const store = new RedisStore({
      client: this.valkeyClient,
      prefix: 'sess:',
      ttl: SESSION_IDLE_TTL_SECONDS,
    });

    const sessionMiddleware = session({
      store,
      secret: this.config.getOrThrow<string>('SESSION_SECRET'),
      name: SESSION_COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_IDLE_TTL_SECONDS * 1000,
      },
    });

    const { doubleCsrfProtection } = buildCsrf(this.config);

    consumer
      .apply(
        cookieParser(),
        sessionMiddleware,
        absoluteSessionTtl,
        doubleCsrfProtection,
      )
      .forRoutes('*');
  }
}
