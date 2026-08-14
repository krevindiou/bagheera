import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { SecurityModule } from './security/security.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
    SecurityModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
