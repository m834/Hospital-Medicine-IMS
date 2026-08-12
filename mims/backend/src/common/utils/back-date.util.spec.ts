import { BadRequestException } from '@nestjs/common';
import { resolveBackDate } from './back-date.util';

// A fixed "now" with a distinctive time of day, so it is obvious whether the
// time survived the back-dating.
const NOW = new Date(2026, 7, 12, 14, 32, 9); // 12 Aug 2026, 14:32:09 local

describe('resolveBackDate', () => {
  it('returns the current instant when no date is given', () => {
    expect(resolveBackDate(undefined, NOW)).toBe(NOW);
    expect(resolveBackDate(null, NOW)).toBe(NOW);
    expect(resolveBackDate('', NOW)).toBe(NOW);
  });

  it('moves the date back while keeping the current time of day', () => {
    const result = resolveBackDate('2026-08-10', NOW);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(10);
    // Time of day carried over rather than snapped to midnight
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(32);
    expect(result.getSeconds()).toBe(9);
  });

  it('accepts today itself', () => {
    const result = resolveBackDate('2026-08-12', NOW);
    expect(result.getTime()).toBe(NOW.getTime());
  });

  it('crosses month and year boundaries', () => {
    const result = resolveBackDate('2025-12-31', NOW);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
  });

  it('does not mutate the caller\'s clock', () => {
    const before = NOW.getTime();
    resolveBackDate('2026-01-01', NOW);
    expect(NOW.getTime()).toBe(before);
  });

  it('rejects a future date', () => {
    expect(() => resolveBackDate('2026-08-13', NOW)).toThrow(BadRequestException);
    expect(() => resolveBackDate('2026-08-13', NOW)).toThrow(/cannot be in the future/);
  });

  it('rejects a day that does not exist rather than rolling it forward', () => {
    // setFullYear would silently turn 30 Feb into 2 Mar
    expect(() => resolveBackDate('2026-02-30', NOW)).toThrow(/must be a valid date/);
    expect(() => resolveBackDate('2026-04-31', NOW)).toThrow(/must be a valid date/);
    expect(() => resolveBackDate('2026-13-01', NOW)).toThrow(/must be a valid date/);
  });

  it('accepts 29 February in a leap year', () => {
    const result = resolveBackDate('2024-02-29', NOW);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('rejects 29 February in a non-leap year', () => {
    expect(() => resolveBackDate('2025-02-29', NOW)).toThrow(/must be a valid date/);
  });

  it('rejects malformed input', () => {
    expect(() => resolveBackDate('12/08/2026', NOW)).toThrow(/must be a valid date/);
    expect(() => resolveBackDate('2026-8-1', NOW)).toThrow(/must be a valid date/);
    expect(() => resolveBackDate('not-a-date', NOW)).toThrow(/must be a valid date/);
  });

  it('takes the date part of a full ISO timestamp', () => {
    const result = resolveBackDate('2026-08-09T00:00:00.000Z', NOW);

    expect(result.getDate()).toBe(9);
    // The supplied time is ignored — the entry clock is what orders records
    expect(result.getHours()).toBe(14);
  });

  it('names the field in its error messages', () => {
    expect(() => resolveBackDate('2026-08-13', NOW, 'Prescription date')).toThrow(
      'Prescription date cannot be in the future',
    );
    expect(() => resolveBackDate('bad', NOW, 'Prescription date')).toThrow(
      'Prescription date must be a valid date',
    );
  });

  it('back-dates from the last day of a long month into a short one', () => {
    // 31 Mar → Feb would roll to 2/3 Mar if the parts were set one at a time
    const endOfMarch = new Date(2026, 2, 31, 9, 0, 0);
    const result = resolveBackDate('2026-02-15', endOfMarch);

    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(15);
  });
});
