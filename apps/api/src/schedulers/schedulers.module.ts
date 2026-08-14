import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { SchedulerBatchController } from './batch.controller';
import { SchedulerBatchService } from './batch.service';
import { SchedulerGenerationService } from './generation.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [OperationsModule],
  controllers: [SchedulerController, SchedulerBatchController],
  providers: [
    SchedulerService,
    SchedulerGenerationService,
    SchedulerBatchService,
  ],
  exports: [SchedulerService, SchedulerGenerationService],
})
export class SchedulersModule {}
