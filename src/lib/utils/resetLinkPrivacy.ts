/**
 * The emailed reset link carries the raw token in its query string
 * (/auth/reset-password?token=…). For up to 60 minutes that token is a bearer
 * credential for the account, so it must not end up in telemetry, caches or
 * browser history. ResetPasswordForm strips it from the address bar on mount;
 * the helpers below are the second line for everything that records URLs.
 *
 * No imports on purpose: this module is shared by client components, the
 * Sentry configs and the service worker.
 */

export const RESET_PASSWORD_PATH = '/auth/reset-password';

const REDACTED = '[redacted]';
const TOKEN_PARAM = /((?:^|[?&])token=)[^&#\s]*/gi;
const MAX_DEPTH = 8;

/** Replace the value of every `token` query parameter found in a URL or query string */
export function redactResetToken(text: string): string {
  return text.replace(TOKEN_PARAM, `$1${REDACTED}`);
}

function isPlainContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Redact the token in every string of a telemetry payload (Sentry events,
 * transactions and breadcrumbs keep URLs under names that change between SDK
 * versions, so the whole payload is walked instead of a list of known fields).
 * Mutates plain objects and arrays in place and leaves class instances alone:
 * the SDK keeps live objects on the event that must not be cloned.
 */
export function scrubResetToken<T>(payload: T): T {
  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return redactResetToken(value);
    if (depth >= MAX_DEPTH || !isPlainContainer(value) || seen.has(value)) return value;
    seen.add(value);

    const container = value as Record<string, unknown>;
    for (const key of Object.keys(container)) {
      container[key] = visit(container[key], depth + 1);
    }
    return value;
  };

  return visit(payload, 0) as T;
}

/** True for the reset page and anything under it (RSC payloads share the pathname) */
export function isResetPasswordPath(pathname: string): boolean {
  return pathname === RESET_PASSWORD_PATH || pathname.startsWith(`${RESET_PASSWORD_PATH}/`);
}
