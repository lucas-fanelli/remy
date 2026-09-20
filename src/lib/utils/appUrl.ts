const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Reduce a configured URL to its origin, or null when it is not a usable http(s) URL. */
function toOrigin(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopback(origin: string): boolean {
  return LOOPBACK_HOSTS.has(new URL(origin).hostname);
}

/**
 * Canonical public origin of the app (no trailing slash), for links that leave
 * the app such as the ones in emails.
 *
 * SECURITY: this deliberately takes no request. Building the origin from the
 * Host / X-Forwarded-Host headers would let an attacker poison password reset
 * links (host header injection), so only server-side configuration is trusted:
 *
 *   1. NEXT_PUBLIC_APP_URL
 *   2. VERCEL_PROJECT_PRODUCTION_URL (Vercel system variable, host without scheme)
 *   3. http://localhost:3000, in development only
 *
 * Returns null when nothing usable is configured; callers must not send links then.
 */
export function getAppBaseUrl(): string | null {
  const isProduction = process.env.NODE_ENV === 'production';

  const configured = toOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) {
    // A production build that still carries the .env.example value would email
    // links to the reader's own machine; fall through to the next source instead.
    if (!isProduction || !isLoopback(configured)) return configured;
    console.error('[APP_URL] NEXT_PUBLIC_APP_URL points to localhost in production; ignoring it');
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelOrigin = toOrigin(vercelHost ? `https://${vercelHost}` : undefined);
  if (vercelOrigin) return vercelOrigin;

  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';

  return null;
}
