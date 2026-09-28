import { formatKarachiDate, formatKarachiDateTime, karachiToday } from '../karachi-date';

/**
 * The bug these guard: a receipt raised in the early hours in Quetta falls on
 * the previous UTC day, so any formatter that leans on UTC — or on a machine
 * whose clock is not set to Pakistan — prints yesterday's date for the whole
 * night shift.
 */
describe('formatKarachiDate', () => {
  it('formats as DD/MM/YYYY', () => {
    expect(formatKarachiDate('2026-09-25T09:15:00+05:00')).toBe('25/09/2026');
  });

  // 00:30 in Karachi is 19:30 the previous day in UTC.
  it('keeps a receipt raised just after midnight on its own day', () => {
    expect(formatKarachiDate('2026-09-27T19:30:00Z')).toBe('28/09/2026');
  });

  // 04:59 Karachi is 23:59 the previous day UTC — the last minute of the gap.
  it('holds the day through to 5am, the end of the UTC offset window', () => {
    expect(formatKarachiDate('2026-09-27T23:59:00Z')).toBe('28/09/2026');
  });

  it('rolls over exactly at Karachi midnight, not at UTC midnight', () => {
    // 18:59:59Z is 23:59:59 in Karachi — still the 27th there.
    expect(formatKarachiDate('2026-09-27T18:59:59Z')).toBe('27/09/2026');
    // One second later it is the 28th in Karachi, while UTC is still the 27th.
    expect(formatKarachiDate('2026-09-27T19:00:00Z')).toBe('28/09/2026');
  });

  it('is unaffected by the machine the print is run from', () => {
    const moment = '2026-09-27T19:30:00Z';
    // Whatever TZ the process carries, the zone is named in the formatter.
    expect(formatKarachiDate(moment)).toBe('28/09/2026');
    expect(formatKarachiDate(new Date(moment))).toBe('28/09/2026');
  });

  it('treats a plain calendar day as that day', () => {
    expect(formatKarachiDate('2026-09-25')).toBe('25/09/2026');
  });

  it('falls back to today when given nothing', () => {
    expect(formatKarachiDate()).toBe(formatKarachiDate(new Date()));
    expect(formatKarachiDate(undefined)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('returns empty rather than "Invalid Date" for a value it cannot read', () => {
    expect(formatKarachiDate('not a date')).toBe('');
  });
});

describe('formatKarachiDateTime', () => {
  it('shows the Karachi wall clock, not UTC', () => {
    // 19:30Z is 00:30 on the 28th in Karachi.
    expect(formatKarachiDateTime('2026-09-27T19:30:00Z')).toBe('28/09/2026, 00:30');
  });
});

describe('karachiToday', () => {
  it('is an ISO calendar day', () => {
    expect(karachiToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('names the same day the receipts are dated with', () => {
    const [year, month, day] = karachiToday().split('-');
    expect(formatKarachiDate()).toBe(`${day}/${month}/${year}`);
  });
});
