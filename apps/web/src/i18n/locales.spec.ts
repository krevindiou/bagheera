import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  detectLocale,
  getStoredLocale,
  isSupportedLocale,
  setStoredLocale,
  SUPPORTED_LOCALES,
} from './locales';

describe('isSupportedLocale', () => {
  it.each(SUPPORTED_LOCALES)('accepts %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
  });

  it('rejects an unsupported code', () => {
    expect(isSupportedLocale('de')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
    expect(isSupportedLocale(['en'])).toBe(false);
  });
});

describe('getStoredLocale/setStoredLocale', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a stored locale', () => {
    setStoredLocale('fr');
    expect(getStoredLocale()).toBe('fr');
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredLocale()).toBeNull();
  });

  it('ignores a stored value that is no longer supported', () => {
    localStorage.setItem('bagheera.locale', 'de');
    expect(getStoredLocale()).toBeNull();
  });
});

describe('detectLocale', () => {
  const languagesSpy = vi.spyOn(window.navigator, 'languages', 'get');

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    languagesSpy.mockReset();
  });

  it('prefers a previously stored manual choice over the browser language', () => {
    setStoredLocale('fr');
    languagesSpy.mockReturnValue(['en-US']);
    expect(detectLocale()).toBe('fr');
  });

  it('matches a supported browser language when nothing is stored', () => {
    languagesSpy.mockReturnValue(['fr-FR', 'en-US']);
    expect(detectLocale()).toBe('fr');
  });

  it('skips an unsupported language before finding a supported one', () => {
    languagesSpy.mockReturnValue(['de-DE', 'fr-CA']);
    expect(detectLocale()).toBe('fr');
  });

  it('falls back to DEFAULT_LOCALE when nothing matches', () => {
    languagesSpy.mockReturnValue(['de-DE', 'ja-JP']);
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });
});
