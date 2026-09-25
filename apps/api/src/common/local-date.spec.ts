import { appTimeZone, localIsoDate } from './local-date';

describe('localIsoDate', () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Paris.
  const lateEvening = new Date('2025-12-31T23:30:00Z');

  it('uses the given time zone for the calendar day', () => {
    expect(localIsoDate(lateEvening, 'Europe/Paris')).toBe('2026-01-01');
    expect(localIsoDate(lateEvening, 'UTC')).toBe('2025-12-31');
  });

  it('defaults to APP_TIMEZONE, then UTC', () => {
    const previous = process.env.APP_TIMEZONE;
    try {
      delete process.env.APP_TIMEZONE;
      expect(appTimeZone()).toBe('UTC');
      expect(localIsoDate(lateEvening)).toBe('2025-12-31');
      process.env.APP_TIMEZONE = 'Europe/Paris';
      expect(localIsoDate(lateEvening)).toBe('2026-01-01');
    } finally {
      if (previous === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = previous;
    }
  });
});
