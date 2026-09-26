// The app's calendar day (`YYYY-MM-DD`) follows a time zone, not UTC, so
// "today" and month boundaries match what members see on their wall clock:
// the member's own `time_zone` where one is known (see member-today.ts),
// else APP_TIMEZONE.
export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || 'UTC';
}

export function localIsoDate(now: Date = new Date(), timeZone: string = appTimeZone()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Fits the `member.time_zone` column.
export const TIME_ZONE_MAX_LENGTH = 64;

// An IANA zone name (`Europe/Paris`, `UTC`, `Etc/GMT+12`) the runtime knows.
// Offset strings (`+01:00`), which recent Intl versions also accept, are
// refused: they don't follow daylight saving time.
export function isValidTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > TIME_ZONE_MAX_LENGTH ||
    !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
