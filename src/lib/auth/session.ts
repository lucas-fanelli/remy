/**
 * Session lifetime — the one source of truth.
 *
 * The JWT expiry (TokenService) and the auth cookie maxAge (cookies.ts) both come
 * from getSessionLifetimeSeconds(), so the two can never disagree. Server-side only.
 */

export const DEFAULT_SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60; // 30 days

const MAX_RENEW_AFTER_SECONDS = 24 * 60 * 60; // 24 hours

const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 };

/**
 * Parse a duration like "30d", "24h", "60m" or "3600s" into seconds.
 * Returns null for anything else (including a zero duration).
 */
export function parseDurationSeconds(value: string | undefined): number | null {
  const match = /^(\d+)([smhd])$/.exec(value?.trim() ?? '');
  if (!match) return null;

  const seconds = Number(match[1]) * SECONDS_PER_UNIT[match[2]];
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

/** How long a session lasts without activity: JWT_EXPIRES_IN, or 30 days when missing or invalid */
export function getSessionLifetimeSeconds(): number {
  return parseDurationSeconds(process.env.JWT_EXPIRES_IN) ?? DEFAULT_SESSION_LIFETIME_SECONDS;
}

/**
 * Sliding renewal threshold: a valid token older than this is replaced by a fresh one.
 * 24 hours, or half the lifetime when that is shorter — otherwise a lifetime of 24h
 * or less would expire before it ever became old enough to renew.
 */
export function getSessionRenewAfterSeconds(): number {
  return Math.min(MAX_RENEW_AFTER_SECONDS, Math.floor(getSessionLifetimeSeconds() / 2));
}
