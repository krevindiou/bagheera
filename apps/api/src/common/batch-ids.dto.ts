import { ArrayMaxSize, ArrayNotEmpty, IsUUID } from 'class-validator';

// Batch actions (operations/reports/schedulers): the caller submits the ids
// it believes it owns; foreign or nonexistent ids are silently skipped.
// Capped well above any realistic UI selection to bound query/transaction
// size.
export class BatchIdsDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('7', { each: true })
  ids!: string[];
}
