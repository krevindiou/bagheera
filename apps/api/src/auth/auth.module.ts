import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { ChangePasswordController } from './change-password.controller';
import { ChangePasswordService } from './change-password.service';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { SchedulerCatchUpService } from './scheduler-catch-up.service';
import { SignInController } from './sign-in.controller';
import { SignInService } from './sign-in.service';
import { SignInThrottleAuditFilter } from './sign-in-throttle-audit.filter';
import { SignOutController } from './sign-out.controller';
import { SignOutService } from './sign-out.service';

@Module({
  imports: [SessionModule],
  controllers: [
    SignInController,
    SignOutController,
    PasswordRecoveryController,
    ChangePasswordController,
  ],
  providers: [
    SignInService,
    SchedulerCatchUpService,
    SignOutService,
    PasswordRecoveryService,
    ChangePasswordService,
    SignInThrottleAuditFilter,
  ],
  exports: [SchedulerCatchUpService],
})
export class AuthModule {}
