import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import type { ConfirmImportDto } from './import.dto';

// Above the nine fields of a confirmation and the three of a change.
export const MAX_KEYS = 16;

const LIST_FIELDS: ReadonlySet<string> = new Set<keyof ConfirmImportDto>([
  'labelChanges',
  'paymentMethodChanges',
  'categoryChanges',
  'transferAccountChanges',
  'reconcileLines',
  'includedLines',
]);

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

const isScalar = (value: unknown) => !isObject(value);

// A scalar, or a change: a few fields holding scalars.
function isFlat(value: unknown): boolean {
  if (isScalar(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length <= MAX_KEYS && keys.every((key) => isScalar(record[key]));
}

function isList(value: unknown): boolean {
  return Array.isArray(value) && value.length <= IMPORT_LIMITS.MAX_ROWS && value.every(isFlat);
}

// The 2 MB an import body may take is far more than its lists can hold, and
// ValidationPipe builds and walks every element and nested value whatever a
// limit says, while class-transformer compares an object's keys pairwise.
// So a body that is not a few scalars and lists of flat changes is refused
// ahead of it, each object's keys listed once.
@Injectable()
export class ImportListLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body: unknown = context.switchToHttp().getRequest<Request>().body;
    if (body === undefined || body === null) {
      return true;
    }
    if (!isObject(body) || Array.isArray(body)) {
      throw new BadRequestException('Body must be a JSON object');
    }
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length > MAX_KEYS) {
      throw new BadRequestException('Body has too many fields');
    }
    for (const key of keys) {
      const value = record[key];
      const fits = LIST_FIELDS.has(key) && Array.isArray(value) ? isList(value) : isScalar(value);
      if (!fits) {
        throw new BadRequestException('Body has a field of an unexpected shape or size');
      }
    }
    return true;
  }
}
