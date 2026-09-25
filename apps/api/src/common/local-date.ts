// The app's calendar day (`YYYY-MM-DD`) follows APP_TIMEZONE, not UTC, so
// "today" and month boundaries match what members see on their wall clock.
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
