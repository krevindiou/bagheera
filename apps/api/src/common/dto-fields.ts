import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
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

/**
 * A new password being set (registration, password reset/change) —
 * unlike SecretField, this enforces a minimum length, since the value is
 * being chosen here, not just checked.
 */
export function NewPasswordField(): PropertyDecorator {
  return Length(8, 4096);
}
