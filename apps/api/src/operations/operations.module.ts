import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { OperationBatchController } from './batch.controller';
import { OperationBatchService } from './batch.service';
import { OperationController } from './operation.controller';
import { OperationService } from './operation.service';
import { OperationSearchController } from './search.controller';
import { OperationSearchService } from './search.service';

@Module({
  imports: [SessionModule],
  controllers: [
    OperationController,
    OperationBatchController,
    OperationSearchController,
  ],
  providers: [OperationService, OperationBatchService, OperationSearchService],
  exports: [OperationService, OperationBatchService, OperationSearchService],
})
export class OperationsModule {}
