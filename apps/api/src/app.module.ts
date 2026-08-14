import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { MembersModule } from './members/members.module';
import { SecurityModule } from './security/security.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
    SecurityModule,
    SessionModule,
    EmailModule,
    MembersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
