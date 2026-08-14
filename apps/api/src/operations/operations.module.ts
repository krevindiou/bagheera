import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { OperationBatchController } from './batch.controller';
import { OperationBatchService } from './batch.service';
import { OperationController } from './operation.controller';
import { OperationService } from './operation.service';
import { OperationSearchController } from './search.controller';
import { OperationSearchService } from './search.service';
import { TransferService } from './transfer.service';

@Module({
  imports: [SessionModule],
  controllers: [
    OperationController,
    OperationBatchController,
    OperationSearchController,
  ],
  providers: [
    OperationService,
    OperationBatchService,
    OperationSearchService,
    TransferService,
  ],
  exports: [
    OperationService,
    OperationBatchService,
    OperationSearchService,
    TransferService,
  ],
})
export class OperationsModule {}
