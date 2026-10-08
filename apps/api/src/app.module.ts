import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { BanksModule } from './banks/banks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DbModule } from './db/db.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { MembersModule } from './members/members.module';
import { OperationsModule } from './operations/operations.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulersModule } from './schedulers/schedulers.module';
import { SecurityModule } from './security/security.module';
import { SessionModule } from './session/session.module';
import { WebauthnModule } from './webauthn/webauthn.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    DbModule,
    HealthModule,
    // SessionModule before SecurityModule: this order makes SessionAuthGuard
    // run before RateLimitGuard (pinned by session.integration-spec.ts).
    SessionModule,
    SecurityModule,
    EmailModule,
    MembersModule,
    AuthModule,
    WebauthnModule,
    BanksModule,
    AccountsModule,
    OperationsModule,
    ReferenceDataModule,
    SchedulersModule,
    ReportsModule,
    DashboardModule,
  ],
})
export class AppModule {}
