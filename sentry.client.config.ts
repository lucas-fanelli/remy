import * as Sentry from '@sentry/nextjs';
import { scrubResetToken } from './src/lib/utils/resetLinkPrivacy';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Replay is only available in the client
  replaysOnErrorSampleRate: 1.0,

  // Capture 10% of all sessions for performance monitoring
  replaysSessionSampleRate: 0.1,

  // /auth/reset-password?token=… carries a credential: never ship it in a URL
  beforeSend: (event) => scrubResetToken(event),
  beforeSendTransaction: (event) => scrubResetToken(event),
  beforeBreadcrumb: (breadcrumb) => scrubResetToken(breadcrumb),

  // Ignore common network errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /^Loading chunk .* failed/,
  ],
});
