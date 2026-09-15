import { describe, expect, it } from 'vitest';
import { getPasswordStrength, passwordValidationKey } from './usePasswordStrength';

describe('getPasswordStrength', () => {
  it('scores an empty/very short password as weak (0)', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: 'weak' });
  });

  it('scores an 8+ char, single-character-class password as weak (1)', () => {
    expect(getPasswordStrength('abcdefgh')).toEqual({ score: 1, label: 'weak' });
  });

  it('scores an 8+ char password with 2 character classes as fair (2)', () => {
    expect(getPasswordStrength('abcdefgH')).toEqual({ score: 2, label: 'fair' });
  });

  it('scores a 12+ char password with 3 character classes as good (3)', () => {
    expect(getPasswordStrength('abcdefghijA1')).toEqual({ score: 3, label: 'good' });
  });

  it('scores a 16+ char password with all 4 character classes as strong (4)', () => {
    expect(getPasswordStrength('aA1!aA1!aA1!aA1!')).toEqual({ score: 4, label: 'strong' });
  });

  it('requires both the length and variety threshold together for a given score', () => {
    // 16 chars, but only 2 character classes — capped at score 2, not 4.
    expect(getPasswordStrength('aaaaaaaaaaaaaaaA')).toEqual({ score: 2, label: 'fair' });
  });
});

describe('passwordValidationKey', () => {
  // Only ever called from a template's v-if="errors.password" branch — a
  // password long and varied enough to actually pass both checks never
  // reaches it, so there's no "correct" key to assert for one here.

  it('blames length under 8 chars, even if what little there is mixes classes', () => {
    expect(passwordValidationKey('aA1!')).toBe('auth.validation.passwordLength');
    expect(passwordValidationKey('')).toBe('auth.validation.passwordLength');
  });

  it('blames weakness for an 8+ char, single-character-class password', () => {
    expect(passwordValidationKey('abcdefgh')).toBe('auth.validation.passwordWeak');
  });
});
