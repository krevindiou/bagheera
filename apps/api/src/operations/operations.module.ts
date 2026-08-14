import { Module } from '@nestjs/common';
import { OperationBatchController } from './batch.controller';
import { OperationBatchService } from './batch.service';
import { OperationController } from './operation.controller';
import { OperationService } from './operation.service';

@Module({
  controllers: [OperationController, OperationBatchController],
  providers: [OperationService, OperationBatchService],
  exports: [OperationService, OperationBatchService],
})
export class OperationsModule {}
