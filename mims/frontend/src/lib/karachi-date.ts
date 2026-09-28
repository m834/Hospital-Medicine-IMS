/**
 * Dates for anything printed or displayed to staff, fixed to Pakistan time.
 *
 * The hospital runs on Asia/Karachi (UTC+05:00) and timestamps are stored as
 * they always were — this converts only at the point of display.
 *
 * Why not the machine's local time: formatting with the browser's own
 * timezone reads correctly on a reception PC set to Karachi and silently
 * wrongly on one that is not — a laptop left on UTC prints yesterday's date
 * for every receipt between midnight and 5am, which is exactly when the night
 * shift is working. Naming the zone removes the machine from the question.
 */

const KARACHI = 'Asia/Karachi';

/** en-GB gives DD/MM/YYYY, which is the format the receipts are printed in. */
const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: KARACHI,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DAY_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: KARACHI,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const toDate = (value?: string | Date | null): Date | null => {
  if (value == null || value === '') return new Date();

  // A plain calendar day (2026-09-25) parses as UTC midnight, which is 5am in
  // Karachi — the same day either way, so it needs no special handling.
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * DD/MM/YYYY in Karachi time. Pass the moment the thing happened — a receipt's
 * own date, not the moment it is being printed — so a reprint still shows the
 * day the receipt was raised. Omit the argument for today.
 */
export function formatKarachiDate(value?: string | Date | null): string {
  const date = toDate(value);
  return date ? DAY_FORMAT.format(date) : '';
}

/** DD/MM/YYYY, HH:mm in Karachi time, for screens that show a time of day. */
export function formatKarachiDateTime(value?: string | Date | null): string {
  const date = toDate(value);
  return date ? DAY_TIME_FORMAT.format(date) : '';
}

/**
 * Today in Karachi as an ISO calendar day (YYYY-MM-DD), for date inputs and
 * range filters that must agree with what the receipts say.
 */
export function karachiToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KARACHI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // en-CA already yields YYYY-MM-DD.
  return parts;
}
