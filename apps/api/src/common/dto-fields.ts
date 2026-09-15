import { AMOUNT_CEILING } from '@bagheera/money';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

// Composed class-validator property decorators for the field shapes that
// recur, byte-identical, across DTOs — email, and the two password shapes
// (verifying an existing secret vs setting a new one). Before this, each
// cap was hand-copied from a sibling DTO (see the DTO-bounds commits
// b5c682af, fb3eea17, aaf49ccb, 8f9e7d5e, 720e269d): the cap now lives in
// one place, so there's no number to get wrong or forget.

/** An email address field: `@IsEmail()`, capped to the `member.email` column width. */
export function EmailField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsEmail()(target, propertyKey);
    MaxLength(128)(target, propertyKey);
  };
}

/**
 * A secret submitted to be *verified* against an existing value — a
 * current password, an activation/reset key/token. Only bounds length;
 * unlike NewPasswordField, there's no minimum, since the value being
 * checked isn't being chosen here.
 */
export function SecretField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsString()(target, propertyKey);
    IsNotEmpty()(target, propertyKey);
    MaxLength(4096)(target, propertyKey);
  };
}

// Rejects a password made up of only one character class (all-lowercase,
// all-uppercase, all-digit, or all-symbol) via four negative lookaheads —
// one per class, each asserting the *whole* value isn't composed of that
// class alone. Passes as soon as 2+ classes are mixed in. Mirrors the
// client's getPasswordStrength() score >= 2 ("fair") gate — see
// apps/web/src/composables/usePasswordStrength.ts and each Zod schema's
// `password` refine — length is NewPasswordField's own separate Length()
// check below, not this regex's concern.
const MIN_TWO_CHARACTER_CLASSES = /^(?![a-z]+$)(?![A-Z]+$)(?!\d+$)(?![^a-zA-Z\d]+$).+$/;

/**
 * A new password being set (registration, password reset/change) —
 * unlike SecretField, this enforces a minimum length and a minimum
 * complexity, since the value is being chosen here, not just checked.
 */
export function NewPasswordField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    Length(8, 4096)(target, propertyKey);
    Matches(MIN_TWO_CHARACTER_CLASSES, {
      message: 'Password must use at least two of: lowercase, uppercase, numbers, symbols.',
    })(target, propertyKey);
  };
}

// Second wave: name-like and free-text fields, each capped to its own real
// constraint rather than a hand-copied number (see db/schema/*.ts for the
// name-like ones; notes is application-chosen, the column itself is
// unbounded `text`). One private shape behind separate concept-named
// builders, matching EmailField/SecretField/NewPasswordField above rather
// than one parameterized builder — so a caller writes `@ThirdPartyField()`,
// not `@NameField(64)` with a number to look up meaning for.

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
