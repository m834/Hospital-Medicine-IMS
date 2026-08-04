/**
 * MRNs are stored in full (`MRN-YYYYMMDD-482913`) but staff only ever see and
 * type the short code (`482913`). Any lookup that takes an MRN from a user must
 * therefore accept either form.
 */

/**
 * Strip the `MRN-YYYYMMDD-` prefix, leaving the short code staff read out.
 * Legacy sequential codes repeat across days, so those keep their date — they
 * shorten to `20260627-0001`, which still identifies one patient.
 */
export function shortMrn(nrNumber: string | null | undefined): string {
  if (!nrNumber) return '';
  const match = /^MRN-(\d{8})-(.+)$/i.exec(nrNumber.trim());
  if (!match) return nrNumber.trim();
  const [, date, code] = match;
  return isUniqueMrnCode(code) ? code : `${date}-${code}`;
}

/**
 * Endpoints that accept "a patient id or an MRN" use this to tell the two
 * apart — short MRN codes are plain digits and no longer self-identify.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Legacy MRNs (everything registered before the random-code scheme) use a
 * per-day sequential counter — `MRN-20260627-0001` and `MRN-20260703-0001` are
 * different patients. Their 4-digit codes are therefore NOT safe to match on
 * their own; only codes at least this long are unique across all patients.
 */
export const MIN_UNIQUE_MRN_CODE_LENGTH = 6;

/** A short code is only usable on its own if it can't collide with a legacy one. */
export function isUniqueMrnCode(code: string): boolean {
  return code.trim().length >= MIN_UNIQUE_MRN_CODE_LENGTH;
}

/**
 * Prisma filter matching a patient by either the full MRN or its short code.
 *
 * A value containing a hyphen is always a complete identifier, never a short
 * code — this covers `MRN-YYYYMMDD-xxxx` and the older `NR-YYYYMMDD-xxxx` rows,
 * which would otherwise be mistaken for codes and suffix-matched into nothing.
 *
 * Bare codes resolve by suffix, but ONLY when they are long enough to be
 * unique. A legacy code like "0001" belongs to 19 different patients, so it
 * falls through to an exact match — which finds nothing, exactly as it did
 * before short codes existed. Never let an ambiguous code pick a patient.
 */
export function mrnFilter(input: string) {
  const value = input.trim();
  const isFullIdentifier = value.includes('-');

  if (!isFullIdentifier && isUniqueMrnCode(value)) {
    return { endsWith: `-${value}`, mode: 'insensitive' as const };
  }
  return { equals: value, mode: 'insensitive' as const };
}
