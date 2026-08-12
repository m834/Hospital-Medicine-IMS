import { BadRequestException } from '@nestjs/common';

/**
 * Resolve the timestamp a record is filed under when the user entered it for
 * an earlier date.
 *
 * The current time of day is kept on the chosen date rather than snapping to
 * midnight, so several records entered for the same past date still order by
 * when they were entered instead of collapsing onto one instant.
 *
 * A future date is refused: stock would leave the shelf on a day the reports
 * have not reached, leaving a period whose totals change after the fact.
 *
 * @param backDate  yyyy-mm-dd, or undefined for "now"
 * @param now       the real clock, passed in so callers share one instant
 * @param label     what to call the field in error messages
 */
export function resolveBackDate(
  backDate: string | undefined | null,
  now: Date,
  label = 'Date',
): Date {
  if (!backDate) return now;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(backDate.slice(0, 10));
  if (!match) {
    throw new BadRequestException(`${label} must be a valid date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const recorded = new Date(now);
  recorded.setFullYear(year, month - 1, day);

  // setFullYear rolls impossible dates forward — 30 Feb becomes 2 Mar — so
  // read the parts back rather than trusting the assignment.
  if (
    recorded.getFullYear() !== year ||
    recorded.getMonth() !== month - 1 ||
    recorded.getDate() !== day
  ) {
    throw new BadRequestException(`${label} must be a valid date`);
  }

  if (recorded.getTime() > now.getTime()) {
    throw new BadRequestException(`${label} cannot be in the future`);
  }

  return recorded;
}
