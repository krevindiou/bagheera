import { ArrayMaxSize, ArrayNotEmpty, IsInt, Min } from 'class-validator';

// Batch actions: caller submits the ids it believes it owns; foreign
// or nonexistent ids are silently skipped rather than rejected. Capped
// well above any realistic UI selection to bound the resulting query/
// transaction size.
//
// Shared by operations/reports/schedulers' batch endpoints — the class was
// byte-identical in all three before this, and Nest's Swagger plugin
// already emitted one `BatchIdsDto` schema for all of them (a class name
// collision, not a real distinction), so consolidating it changes nothing
// about the generated API contract.
export class BatchIdsDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
