import { ArrayNotEmpty, IsInt, Min } from 'class-validator';

// Batch actions: caller submits the ids it believes it owns; foreign
// or nonexistent ids are silently skipped rather than rejected.
export class BatchIdsDto {
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
