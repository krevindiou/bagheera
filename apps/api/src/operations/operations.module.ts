import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { OperationAutocompleteController } from './autocomplete.controller';
import { OperationAutocompleteService } from './autocomplete.service';
import { OperationBatchController } from './batch.controller';
import { OperationBatchService } from './batch.service';
import { ImportController } from './import/import.controller';
import { ImportHistory } from './import/import.history';
import { ImportPicks } from './import/import.picks';
import { ImportService } from './import/import.service';
import { ImportStore } from './import/import.store';
import { ImportWriter } from './import/import.writer';
import { LabelCorrectionController } from './label-corrections/label-corrections.controller';
import { LabelCorrectionService } from './label-corrections/label-corrections.service';
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
    OperationAutocompleteController,
    ImportController,
    LabelCorrectionController,
  ],
  providers: [
    OperationService,
    OperationBatchService,
    OperationSearchService,
    OperationAutocompleteService,
    TransferService,
    ImportService,
    ImportHistory,
    ImportPicks,
    ImportWriter,
    ImportStore,
    LabelCorrectionService,
  ],
  exports: [
    OperationService,
    OperationBatchService,
    OperationSearchService,
    OperationAutocompleteService,
    TransferService,
  ],
})
export class OperationsModule {}
