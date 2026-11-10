import { Inject, MiddlewareConsumer, Module, NestModule, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import type IORedis from 'ioredis';
import { closeValkeyClient } from '../common/valkey-client';
import { absoluteSessionTtl } from './absolute-session-ttl.middleware';
import { buildCsrf } from './csrf';
import { CsrfTokenController } from './csrf-token.controller';
import { SessionAuthGuard } from './session-auth.guard';
import { signedInImportBody } from './signed-in-import-body';
import { SessionRegistryService } from './session-registry.service';
import { SessionRotationService } from './session-rotation.service';
import { SingleUseStore } from './single-use-store';
import { SESSION_COOKIE_NAME, SESSION_IDLE_TTL_SECONDS, VALKEY_CLIENT } from './session.constants';
import { SessionStore } from './session-store';
import { valkeyClientProvider } from './valkey-client.provider';

@Module({
  imports: [ConfigModule],
  controllers: [CsrfTokenController],
  providers: [
    valkeyClientProvider,
    SessionRotationService,
    SessionRegistryService,
    SingleUseStore,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [SessionRotationService, SessionRegistryService, SingleUseStore, VALKEY_CLIENT],
})
export class SessionModule implements NestModule, OnModuleDestroy {
  constructor(
    @Inject(VALKEY_CLIENT) private readonly valkeyClient: IORedis,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await closeValkeyClient(this.valkeyClient);
  }

  configure(consumer: MiddlewareConsumer): void {
    const sessionMiddleware = session({
      store: new SessionStore(this.valkeyClient),
      secret: this.config.getOrThrow<string>('SESSION_SECRET'),
      name: SESSION_COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
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
        signedInImportBody,
      )
      // The deploy health check polls /health every few seconds, forever — it never
      // needs a session, so it shouldn't load, refresh or create one.
      .exclude('health')
      .forRoutes('*');
  }
}
