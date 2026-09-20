import { AMOUNT_CEILING } from '@bagheera/money';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LOCALES } from './locale';

// Composed class-validator property decorators for the field shapes that
// recur, byte-identical, across DTOs — email, and a length-bounded secret
// (a token/key submitted to be verified, not chosen — authentication is
// WebAuthn-only, so there's no password shape to compose here anymore).
// Before this, each cap was hand-copied from a sibling DTO (see the
// DTO-bounds commits b5c682af, fb3eea17, aaf49ccb, 8f9e7d5e, 720e269d): the
// cap now lives in one place, so there's no number to get wrong or forget.

/** An email address field: `@IsEmail()`, capped to the `member.email` column width. */
export function EmailField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsEmail()(target, propertyKey);
    MaxLength(128)(target, propertyKey);
  };
}

/**
 * A UI/email locale, checked against SUPPORTED_LOCALES (common/locale.ts —
 * the source of truth the `locale` pg enum also derives from). Required by
 * default; callers where it's optional (e.g. registration, which falls
 * back to DEFAULT_LOCALE) stack their own `@IsOptional()` on top.
 */
export function LocaleField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsIn(SUPPORTED_LOCALES)(target, propertyKey);
  };
}

/**
 * A secret submitted to be *verified* — a WebAuthn signup/activation key,
 * an email-change confirmation key. Only bounds length; the value isn't
 * being chosen here, just checked.
 */
export function SecretField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsString()(target, propertyKey);
    IsNotEmpty()(target, propertyKey);
    MaxLength(4096)(target, propertyKey);
  };
}

// Second wave: name-like and free-text fields, each capped to its own real
// constraint rather than a hand-copied number (see db/schema/*.ts for the
// name-like ones; notes is application-chosen, the column itself is
// unbounded `text`). One private shape behind separate concept-named
// builders, matching EmailField/SecretField above rather than one
// parameterized builder — so a caller writes `@ThirdPartyField()`, not
// `@NameField(64)` with a number to look up meaning for.

/** A required, non-empty string capped to `maxLength` — shared shape behind the concept-named builders below. */
function boundedName(maxLength: number): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsString()(target, propertyKey);
    MinLength(1)(target, propertyKey);
    MaxLength(maxLength)(target, propertyKey);
  };
}

/** An account's display name: capped to the `account.name` column width. */
export function AccountNameField(): PropertyDecorator {
  return boundedName(64);
}

/**
 * A third party's name, on an operation or scheduler: capped to the
 * `third_party` column width shared by both tables.
 */
export function ThirdPartyField(): PropertyDecorator {
  return boundedName(64);
}

/** A report's title: capped to the `report.title` column width. */
export function ReportTitleField(): PropertyDecorator {
  return boundedName(64);
}

/**
 * A bank's display name: capped to the `bank.name` column width — narrower
 * than the other name-like fields above, not a number to reconcile with them.
 */
export function BankNameField(): PropertyDecorator {
  return boundedName(32);
}

/**
 * Free-text notes on an operation/scheduler. An application-chosen ceiling,
 * not schema-derived — the column itself is unbounded `text` — reusing the
 * same 4096 SecretField() already does for an unrelated reason, this
 * codebase's de facto generous free-text cap.
 */
export function NotesField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsOptional()(target, propertyKey);
    IsString()(target, propertyKey);
    MaxLength(4096)(target, propertyKey);
  };
}

/**
 * A monetary amount entered by the member — always positive; the sign is
 * derived from the operation/scheduler's own `type` field, never from this
 * value. The upper bound (AMOUNT_CEILING, from the shared @bagheera/money
 * package) isn't a realistic transaction size — it's a sanity ceiling that
 * keeps `toMinorUnits()`'s ×MONEY_SCALE scaling well clear of
 * floating-point precision loss and the `debit`/`credit` columns' `bigint`
 * range (Number.MAX_SAFE_INTEGER / MONEY_SCALE is ~900 billion; this
 * leaves three orders of magnitude of headroom below that).
 */
export function AmountField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsNumber()(target, propertyKey);
    IsPositive()(target, propertyKey);
    Max(AMOUNT_CEILING)(target, propertyKey);
  };
}
