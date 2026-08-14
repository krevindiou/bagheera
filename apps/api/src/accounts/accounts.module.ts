import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [OperationsModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountsModule {}
