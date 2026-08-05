/**
 * Session length for the access token.
 *
 * Staff work full shifts and must not be signed out mid-shift, so the session
 * is never allowed to fall below eight hours. A short or malformed value in the
 * environment is raised to that floor rather than silently shortening sessions.
 */

export const MIN_SESSION_SECONDS = 8 * 60 * 60; // 8 hours
export const DEFAULT_SESSION = '24h';

/** Parse a jsonwebtoken-style duration ("30s", "15m", "24h", "7d", "3600"). */
export function durationToSeconds(value: string): number | null {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier =
    unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;

  return amount * multiplier;
}

/**
 * Resolve the configured session length, never returning less than the floor.
 * Returns seconds (jsonwebtoken accepts a number) or the default string when
 * nothing is configured.
 */
export function resolveSessionExpiry(configured?: string | null): string | number {
  if (!configured) return DEFAULT_SESSION;

  const seconds = durationToSeconds(configured);
  if (seconds === null) return DEFAULT_SESSION; // unparseable — use the default

  return Math.max(seconds, MIN_SESSION_SECONDS);
}
