import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { SchedulerCatchUpService } from './scheduler-catch-up.service';
import { SignInController } from './sign-in.controller';
import { SignInService } from './sign-in.service';
import { SignOutController } from './sign-out.controller';
import { SignOutService } from './sign-out.service';

@Module({
  imports: [SessionModule],
  controllers: [SignInController, SignOutController],
  providers: [SignInService, SchedulerCatchUpService, SignOutService],
  exports: [SchedulerCatchUpService],
})
export class AuthModule {}
