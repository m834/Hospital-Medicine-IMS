import {
  DEFAULT_SESSION,
  MIN_SESSION_SECONDS,
  durationToSeconds,
  resolveSessionExpiry,
} from './session-expiry.util';

describe('session expiry', () => {
  describe('durationToSeconds', () => {
    it('parses the units jsonwebtoken accepts', () => {
      expect(durationToSeconds('30s')).toBe(30);
      expect(durationToSeconds('15m')).toBe(900);
      expect(durationToSeconds('24h')).toBe(86400);
      expect(durationToSeconds('7d')).toBe(604800);
    });

    it('treats a bare number as seconds', () => {
      expect(durationToSeconds('3600')).toBe(3600);
    });

    it('returns null for anything it cannot parse', () => {
      expect(durationToSeconds('soon')).toBeNull();
      expect(durationToSeconds('')).toBeNull();
    });
  });

  describe('resolveSessionExpiry', () => {
    it('keeps a configured value that already exceeds the floor', () => {
      expect(resolveSessionExpiry('24h')).toBe(86400);
      expect(resolveSessionExpiry('12h')).toBe(43200);
    });

    it('raises anything below eight hours up to the floor', () => {
      expect(resolveSessionExpiry('15m')).toBe(MIN_SESSION_SECONDS);
      expect(resolveSessionExpiry('1h')).toBe(MIN_SESSION_SECONDS);
      expect(resolveSessionExpiry('60')).toBe(MIN_SESSION_SECONDS);
    });

    it('accepts exactly eight hours', () => {
      expect(resolveSessionExpiry('8h')).toBe(MIN_SESSION_SECONDS);
    });

    it('falls back to the default when unset or unparseable', () => {
      expect(resolveSessionExpiry(undefined)).toBe(DEFAULT_SESSION);
      expect(resolveSessionExpiry('')).toBe(DEFAULT_SESSION);
      expect(resolveSessionExpiry('whenever')).toBe(DEFAULT_SESSION);
    });
  });
});
