/**
 * Calendar days for the hospital's own clock.
 *
 * The server runs with TZ=Asia/Karachi (see docker-compose), so local time is
 * Pakistan time. toISOString() is UTC — five hours behind — and between
 * midnight and 5am it still names yesterday. Use these instead of slicing an
 * ISO string whenever a day is stamped or stored.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYYMMDD of the local day, for numbers like REC-20261019-0001. */
export function localDateStamp(when: Date = new Date()): string {
  return `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}`;
}

/** YYYY-MM-DD of the local day. */
export function localISODate(when: Date = new Date()): string {
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/**
 * The local day as a date-only value (@db.Date, or a column that stores a day
 * as UTC midnight). Prisma writes a date-only column from the UTC date, so a
 * local midnight (19:00 UTC the day before, in Karachi) would be filed under
 * the previous day; this is midnight UTC of the local day instead.
 */
export function localCalendarDay(when: Date = new Date()): Date {
  return new Date(Date.UTC(when.getFullYear(), when.getMonth(), when.getDate()));
}
