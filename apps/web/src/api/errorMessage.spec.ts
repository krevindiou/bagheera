import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('returns the message for a single-string error', () => {
    expect(errorMessage({ message: 'Bank name already used' })).toBe('Bank name already used');
  });

  it('returns the first message for an array of messages', () => {
    expect(errorMessage({ message: ['First problem', 'Second problem'] })).toBe('First problem');
  });

  it('returns undefined for an uncoded validation error, whose message is raw DTO text', () => {
    expect(
      errorMessage({
        statusCode: 400,
        category: 'validation_error',
        message: ['initialBalance must not be greater than 999999999.9999'],
      }),
    ).toBeUndefined();
  });

  it('returns the message for a non-validation error', () => {
    expect(errorMessage({ category: 'not_found', message: 'Not Found' })).toBe('Not Found');
  });

  it('returns undefined for an error with no message property', () => {
    expect(errorMessage({ status: 500 })).toBeUndefined();
  });

  it('returns undefined for a non-object error', () => {
    expect(errorMessage('plain string error')).toBeUndefined();
    expect(errorMessage(42)).toBeUndefined();
  });

  it('returns undefined for null or undefined', () => {
    expect(errorMessage(null)).toBeUndefined();
    expect(errorMessage(undefined)).toBeUndefined();
  });

  describe('with an error code', () => {
    afterEach(() => {
      void setLocale('en');
    });

    it('translates a known code into the active language', async () => {
      await setLocale('fr');
      expect(errorMessage({ code: 'account_not_active', message: 'Account is not active.' })).toBe(
        "Ce compte n'est pas actif.",
      );
    });

    it('interpolates params, translating the quota kind', async () => {
      expect(
        errorMessage({
          code: 'quota_exceeded',
          params: { limit: 50, kind: 'banks' },
          message: 'You can have at most 50 banks.',
        }),
      ).toBe('You can have at most 50 banks.');
      await setLocale('fr');
      expect(
        errorMessage({
          code: 'quota_exceeded',
          params: { limit: 50, kind: 'banks' },
          message: 'x',
        }),
      ).toBe('Vous pouvez avoir au maximum 50 banques.');
    });

    it('translates a known code on a validation error', () => {
      expect(
        errorMessage({
          category: 'validation_error',
          code: 'account_not_active',
          message: 'Account is not active.',
        }),
      ).toBe('This account is not active.');
    });

    it('returns undefined for an unknown code on a validation error', () => {
      expect(
        errorMessage({ category: 'validation_error', code: 'brand_new', message: 'Fallback text' }),
      ).toBeUndefined();
    });

    it('falls back to the message for an unknown code', () => {
      expect(errorMessage({ code: 'brand_new', message: 'Fallback text' })).toBe('Fallback text');
    });
  });
});
