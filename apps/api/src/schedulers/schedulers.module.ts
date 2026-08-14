import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { SchedulerGenerationService } from './generation.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [OperationsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerGenerationService],
  exports: [SchedulerService, SchedulerGenerationService],
})
export class SchedulersModule {}
