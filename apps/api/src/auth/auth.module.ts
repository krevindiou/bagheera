import { Module } from '@nestjs/common';
import { SchedulersModule } from '../schedulers/schedulers.module';
import { SessionModule } from '../session/session.module';
import { CurrentSessionController } from './current-session.controller';
import { SchedulerCatchUpService } from './scheduler-catch-up.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SignOutController } from './sign-out.controller';
import { SignOutService } from './sign-out.service';

@Module({
  imports: [SessionModule, SchedulersModule],
  controllers: [SignOutController, CurrentSessionController, SessionsController],
  providers: [SchedulerCatchUpService, SignOutService, SessionsService],
  exports: [SchedulerCatchUpService],
})
export class AuthModule {}
