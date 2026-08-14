import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { SchedulerCatchUpService } from './scheduler-catch-up.service';
import { SignInController } from './sign-in.controller';
import { SignInService } from './sign-in.service';

@Module({
  imports: [SessionModule],
  controllers: [SignInController],
  providers: [SignInService, SchedulerCatchUpService],
  exports: [SchedulerCatchUpService],
})
export class AuthModule {}
