import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// Shared `?page=` query param — was three separate `page > 0 ? page : 1`
// clamps (operation.service.ts, search.service.ts, scheduler.service.ts),
// each fed a raw string the controller had already `Number()`-coerced.
// This validates and coerces in one place, and rejects a malformed page
// (non-integer, zero, negative) with a 400 instead of silently
// renormalizing it to page 1.
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
