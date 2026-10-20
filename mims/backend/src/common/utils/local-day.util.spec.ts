import { localCalendarDay, localDateStamp, localISODate } from './local-day.util';

/** These run under the test's own TZ; the values below hold in any zone. */
describe('local-day utils', () => {
  // 1:30am on 19 Oct in whatever zone the tests run in.
  const earlyMorning = new Date(2026, 9, 19, 1, 30);

  it('stamps the local day, not the UTC one', () => {
    expect(localDateStamp(earlyMorning)).toBe('20261019');
    expect(localISODate(earlyMorning)).toBe('2026-10-19');
  });

  it('stores the local day as midnight UTC of that day', () => {
    expect(localCalendarDay(earlyMorning).toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
});
