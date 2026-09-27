import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { localIsoDate } from './local-date';
import { effectiveTimeZone, memberToday } from './member-today';
import { vi } from 'vitest';

// Resolves the `select … from … where` chain to the given rows.
function dbReturning(rows: { timeZone: string | null }[]): NodePgDatabase {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  return { select: vi.fn().mockReturnValue({ from }) } as unknown as NodePgDatabase;
}

describe('effectiveTimeZone', () => {
  const previous = process.env.APP_TIMEZONE;
  beforeEach(() => {
    process.env.APP_TIMEZONE = 'Europe/Paris';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.APP_TIMEZONE;
    else process.env.APP_TIMEZONE = previous;
  });

  it("prefers the member's own zone", () => {
    expect(effectiveTimeZone('America/New_York')).toBe('America/New_York');
  });

  it('falls back to APP_TIMEZONE when the member has none', () => {
    expect(effectiveTimeZone(null)).toBe('Europe/Paris');
    expect(effectiveTimeZone(undefined)).toBe('Europe/Paris');
  });
});

describe('memberToday', () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Paris, still 31 Dec in New York.
  const lateEvening = new Date('2025-12-31T23:30:00Z');

  it("returns the calendar day in the member's own zone", async () => {
    const db = dbReturning([{ timeZone: 'Europe/Paris' }]);
    expect(await memberToday(db, 'member-id', lateEvening)).toBe('2026-01-01');
  });

  it('defaults to the current time', async () => {
    const db = dbReturning([{ timeZone: 'Pacific/Kiritimati' }]);
    expect(await memberToday(db, 'id')).toBe(localIsoDate(new Date(), 'Pacific/Kiritimati'));
  });

  it('uses APP_TIMEZONE for a member with no zone on file, or no row at all', async () => {
    const previous = process.env.APP_TIMEZONE;
    try {
      delete process.env.APP_TIMEZONE;
      expect(await memberToday(dbReturning([{ timeZone: null }]), 'id', lateEvening)).toBe(
        '2025-12-31',
      );
      expect(await memberToday(dbReturning([]), 'id', lateEvening)).toBe('2025-12-31');
    } finally {
      if (previous !== undefined) process.env.APP_TIMEZONE = previous;
    }
  });
});
