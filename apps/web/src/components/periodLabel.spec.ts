import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { formatPeriodLabel } from './periodLabel';

afterEach(async () => {
  await setLocale('en');
});

describe('formatPeriodLabel', () => {
  describe('en', () => {
    it('reads a year bucket as the bare year', () => {
      expect(formatPeriodLabel('2025-01-01', 'en', 'year')).toBe('2025');
      expect(formatPeriodLabel('2026-01-01', 'en', 'year')).toBe('2026');
    });

    it('reads a quarter bucket as Q<n> <year>, whichever month of the quarter is given', () => {
      expect(formatPeriodLabel('2026-01-01', 'en', 'quarter')).toBe('Q1 2026');
      expect(formatPeriodLabel('2026-04-01', 'en', 'quarter')).toBe('Q2 2026');
      expect(formatPeriodLabel('2026-07-01', 'en', 'quarter')).toBe('Q3 2026');
      expect(formatPeriodLabel('2026-10-01', 'en', 'quarter')).toBe('Q4 2026');
      expect(formatPeriodLabel('2026-12', 'en', 'quarter')).toBe('Q4 2026');
    });

    it('reads a month bucket as the short month and year', () => {
      expect(formatPeriodLabel('2026-09-01', 'en', 'month')).toBe('Sep 2026');
      expect(formatPeriodLabel('2026-01', 'en', 'month')).toBe('Jan 2026');
    });

    it('defaults to a month label, and an "all" bucket reads like one', () => {
      expect(formatPeriodLabel('2026-02-01', 'en')).toBe('Feb 2026');
      expect(formatPeriodLabel('2026-01-01', 'en', 'all')).toBe('Jan 2026');
    });
  });

  describe('fr', () => {
    it('reads a year bucket as the bare year', () => {
      expect(formatPeriodLabel('2025-01-01', 'fr', 'year')).toBe('2025');
    });

    it('reads a quarter bucket as T<n> <year>', async () => {
      await setLocale('fr');
      expect(formatPeriodLabel('2026-01-01', 'fr', 'quarter')).toBe('T1 2026');
      expect(formatPeriodLabel('2026-04-01', 'fr', 'quarter')).toBe('T2 2026');
      expect(formatPeriodLabel('2026-07-01', 'fr', 'quarter')).toBe('T3 2026');
      expect(formatPeriodLabel('2026-10-01', 'fr', 'quarter')).toBe('T4 2026');
    });

    it('reads a month bucket as the localized short month and year', () => {
      expect(formatPeriodLabel('2026-09-01', 'fr', 'month')).toBe('sept. 2026');
      expect(formatPeriodLabel('2026-01-01', 'fr', 'month')).toBe('janv. 2026');
    });
  });
});
