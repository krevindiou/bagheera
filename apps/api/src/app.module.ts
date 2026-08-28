import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    DbModule,
    HealthModule,
    SecurityModule,
    SessionModule,
    EmailModule,
    MembersModule,
    AuthModule,
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
