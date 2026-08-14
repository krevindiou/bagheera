import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';

@Module({
  imports: [OperationsModule],
  controllers: [BankController],
  providers: [BankService],
  exports: [BankService],
})
export class BanksModule {}
