import { ArrayMaxSize, ArrayNotEmpty, IsInt, Min } from 'class-validator';

// Batch actions: caller submits the ids it believes it owns; foreign
// or nonexistent ids are silently skipped rather than rejected. Capped
// well above any realistic UI selection to bound the resulting query/
// transaction size.
export class BatchIdsDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
