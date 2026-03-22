/**
 * Log a server-side error. Sends to Sentry if configured, always logs to console.
 * Caches the Sentry module reference at module level to avoid repeated dynamic imports.
 */

let SentryModule: typeof import('@sentry/nextjs') | null = null;
const sentryPromise = import('@sentry/nextjs')
  .then((m) => {
    SentryModule = m;
  })
  .catch(() => {});

export function logAuditEvent(action: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({ type: 'AUDIT', action, ...details, timestamp: new Date().toISOString() })
  );
}

export function logServerError(message: string, error: unknown): void {
  console.error(message, error);

  if (SentryModule) {
    SentryModule.captureException(error instanceof Error ? error : new Error(String(error)));
  } else {
    sentryPromise.then(() => {
      if (SentryModule) {
        SentryModule.captureException(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
