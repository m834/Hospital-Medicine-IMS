/**
 * MRNs are stored in full (`MRN-20260804-482913`) but staff only ever see and
 * say the short code (`482913`). Use this for every MRN shown on screen, on a
 * printout, or in an export — never render the raw nrNumber.
 *
 * Legacy MRNs (everything registered before the random-code scheme) use a
 * per-day sequential counter, so `MRN-20260627-0001` and `MRN-20260703-0001`
 * are different patients. Those codes are NOT unique on their own and keep
 * their date — they render as `20260627-0001`. Anything at least this long is
 * unique across all patients and shortens fully.
 */
export const MIN_UNIQUE_MRN_CODE_LENGTH = 6;

export function isUniqueMrnCode(code: string): boolean {
  return code.trim().length >= MIN_UNIQUE_MRN_CODE_LENGTH;
}

export function formatMRN(nrNumber: string | null | undefined): string {
  if (!nrNumber) return '';
  const match = /^MRN-(\d{8})-(.+)$/i.exec(nrNumber.trim());
  // Anything unrecognised is returned as-is, so nothing ever renders blank.
  if (!match) return nrNumber.trim();
  const [, date, code] = match;
  return isUniqueMrnCode(code) ? code : `${date}-${code}`;
}

/**
 * Case-insensitive match of a search query against an MRN, accepting either the
 * displayed form or the full stored value.
 */
export function matchesMRN(nrNumber: string | null | undefined, query: string): boolean {
  if (!nrNumber) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return nrNumber.toLowerCase().includes(q) || formatMRN(nrNumber).toLowerCase().includes(q);
}
