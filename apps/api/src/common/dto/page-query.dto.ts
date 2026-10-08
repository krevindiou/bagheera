import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// Shared `?page=` query param; a malformed page (non-integer, zero,
// negative) is a 400, not silently page 1.
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
