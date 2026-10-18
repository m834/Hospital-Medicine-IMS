import { formatMRN, formatSlipMRN, matchesMRN } from '../mrn';

describe('formatMRN', () => {
  it('shows only the short code staff read out', () => {
    expect(formatMRN('MRN-20260804-482913')).toBe('482913');
  });

  it('shortens legacy alphanumeric MRNs too', () => {
    expect(formatMRN('MRN-20260703-FMXCJ9')).toBe('FMXCJ9');
  });

  it('keeps the date on legacy sequential codes, which repeat across days', () => {
    expect(formatMRN('MRN-20260627-0001')).toBe('20260627-0001');
    expect(formatMRN('MRN-20260703-0001')).toBe('20260703-0001');
  });

  it('never renders blank for unexpected values', () => {
    expect(formatMRN('482913')).toBe('482913');
    expect(formatMRN('NR-0001')).toBe('NR-0001');
  });

  it('returns an empty string for missing values', () => {
    expect(formatMRN(null)).toBe('');
    expect(formatMRN(undefined)).toBe('');
  });
});

describe('matchesMRN', () => {
  const mrn = 'MRN-20260804-482913';

  it('matches the short code the user sees', () => {
    expect(matchesMRN(mrn, '4829')).toBe(true);
  });

  it('still matches the full stored MRN', () => {
    expect(matchesMRN(mrn, 'mrn-20260804')).toBe(true);
  });

  it('does not match unrelated queries', () => {
    expect(matchesMRN(mrn, '999999')).toBe(false);
  });

  it('treats an empty query as a match and a missing MRN as a miss', () => {
    expect(matchesMRN(mrn, '  ')).toBe(true);
    expect(matchesMRN(undefined, '482913')).toBe(false);
  });
});

describe('formatSlipMRN', () => {
  it('prints the whole MRN as MR- with the date split by dashes', () => {
    expect(formatSlipMRN('MRN-20261018-482913')).toBe('MR-2026-10-18-482913');
  });

  it('keeps a legacy per-day code with its date, which it needs to be unique', () => {
    expect(formatSlipMRN('MRN-20260627-0001')).toBe('MR-2026-06-27-0001');
  });

  it('only re-prefixes an MRN that is not in the dated shape', () => {
    expect(formatSlipMRN('MRN-OLD-77')).toBe('MR-OLD-77');
  });

  it('prints nothing for no MRN', () => {
    expect(formatSlipMRN(undefined)).toBe('');
  });
});
