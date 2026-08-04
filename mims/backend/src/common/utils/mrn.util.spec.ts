import { isUuid, mrnFilter, shortMrn } from './mrn.util';

describe('mrn.util', () => {
  describe('shortMrn', () => {
    it('strips the MRN-YYYYMMDD- prefix', () => {
      expect(shortMrn('MRN-20260804-482913')).toBe('482913');
    });

    it('leaves legacy alphanumeric codes readable', () => {
      expect(shortMrn('MRN-20260703-FMXCJ9')).toBe('FMXCJ9');
    });

    it('keeps the date on legacy sequential codes, which repeat across days', () => {
      expect(shortMrn('MRN-20260627-0001')).toBe('20260627-0001');
      expect(shortMrn('MRN-20260703-0001')).toBe('20260703-0001');
    });

    it('returns anything unrecognised unchanged rather than blank', () => {
      expect(shortMrn('482913')).toBe('482913');
      expect(shortMrn('NR-0001')).toBe('NR-0001');
    });

    it('handles null and empty input', () => {
      expect(shortMrn(null)).toBe('');
      expect(shortMrn(undefined)).toBe('');
      expect(shortMrn('')).toBe('');
    });
  });

  describe('mrnFilter', () => {
    it('matches a full MRN exactly', () => {
      expect(mrnFilter('MRN-20260804-482913')).toEqual({
        equals: 'MRN-20260804-482913',
        mode: 'insensitive',
      });
    });

    it('matches a short code by suffix', () => {
      expect(mrnFilter('482913')).toEqual({ endsWith: '-482913', mode: 'insensitive' });
    });

    it('trims whitespace from typed input', () => {
      expect(mrnFilter('  482913 ')).toEqual({ endsWith: '-482913', mode: 'insensitive' });
    });

    it('refuses to suffix-match ambiguous legacy codes', () => {
      // "0001" belongs to 19 different patients — it must never pick one
      expect(mrnFilter('0001')).toEqual({ equals: '0001', mode: 'insensitive' });
    });

    it('treats the older NR- prefixed MRNs as complete identifiers', () => {
      // Regression: these were suffix-matched into nothing, so prescriptions
      // for these patients failed with "patient not found"
      expect(mrnFilter('NR-20260422-0001')).toEqual({
        equals: 'NR-20260422-0001',
        mode: 'insensitive',
      });
    });

    it('treats any hyphenated value as a complete identifier', () => {
      expect(mrnFilter('SOME-OTHER-ID')).toEqual({
        equals: 'SOME-OTHER-ID',
        mode: 'insensitive',
      });
    });
  });

  describe('isUuid', () => {
    it('recognises a patient UUID', () => {
      expect(isUuid('3f2b6c1e-9a4d-4c88-b0e1-6d2f5a7c9e10')).toBe(true);
    });

    it('rejects short MRN codes', () => {
      expect(isUuid('482913')).toBe(false);
      expect(isUuid('MRN-20260804-482913')).toBe(false);
    });
  });
});
