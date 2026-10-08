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
  Min,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { isValidTimeZone } from './local-date';
import { SUPPORTED_LOCALES } from './locale';
import { isValueDate, MAX_VALUE_DATE, MIN_VALUE_DATE } from './value-date';

// Composed class-validator decorators for field shapes recurring across
// DTOs, so each cap lives in one place.

/** An email address field: `@IsEmail()`, capped to the `member.email` column width. */
export function EmailField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsEmail()(target, propertyKey);
    MaxLength(128)(target, propertyKey);
  };
}

/**
 * A UI/email locale from SUPPORTED_LOCALES. Required; optional callers
 * stack `@IsOptional()` on top.
 */
export function LocaleField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsIn(SUPPORTED_LOCALES)(target, propertyKey);
  };
}

/** An IANA time zone name. Required; optional callers stack `@IsOptional()`. */
export function TimeZoneField(): PropertyDecorator {
  return ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) => isValidTimeZone(value),
      defaultMessage: () => '$property must be a valid IANA time zone',
    },
  });
}

/**
 * A secret submitted to be verified (signup key, email-change key): only
 * its length is bounded.
 */
export function SecretField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsString()(target, propertyKey);
    IsNotEmpty()(target, propertyKey);
    MaxLength(4096)(target, propertyKey);
  };
}

/** A required, non-empty string capped to `maxLength`. */
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

/** A bank's display name: capped to the `bank.name` column width. */
export function BankNameField(): PropertyDecorator {
  return boundedName(32);
}

/** Free-text notes on an operation/scheduler; the column is unbounded `text`. */
export function NotesField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsOptional()(target, propertyKey);
    IsString()(target, propertyKey);
    MaxLength(4096)(target, propertyKey);
  };
}

/**
 * A monetary amount, always positive: the sign comes from the
 * operation/scheduler's `type`. AMOUNT_CEILING is a sanity ceiling keeping
 * `toMinorUnits()` well clear of float precision loss
 * (Number.MAX_SAFE_INTEGER / MONEY_SCALE ≈ 900 billion).
 */
export function AmountField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsNumber()(target, propertyKey);
    IsPositive()(target, propertyKey);
    Max(AMOUNT_CEILING)(target, propertyKey);
  };
}

/**
 * A signed monetary amount (an account's opening balance: positive is a
 * credit, negative a debit), bounded by ±AMOUNT_CEILING like AmountField.
 */
export function SignedAmountField(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    IsNumber()(target, propertyKey);
    Min(-AMOUNT_CEILING)(target, propertyKey);
    Max(AMOUNT_CEILING)(target, propertyKey);
  };
}

/**
 * A member-submitted date (value/limit dates, report range, search filter);
 * see common/value-date.ts for the rule. Required; optional callers stack
 * `@IsOptional()` on top.
 */
export function ValueDateField(): PropertyDecorator {
  return ValidateBy({
    name: 'isValueDate',
    validator: {
      validate: (value: unknown) => isValueDate(value),
      defaultMessage: () =>
        `$property must be a YYYY-MM-DD date between ${MIN_VALUE_DATE} and ${MAX_VALUE_DATE}`,
    },
  });
}
