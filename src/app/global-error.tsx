'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * The only screen in the app that stays English, and deliberately so.
 *
 * global-error REPLACES the root layout - it renders its own <html>/<body> - so by the time
 * it is shown, NextIntlClientProvider never mounted and `useTranslations()` would throw.
 * docs/I18N.md defines no provider-free way to translate, and importing the catalogue here
 * would make the last-resort screen depend on the very module graph whose failure brought it
 * up. `lang="en"` is kept honest with the copy for the same reason. See the report for area E.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error</title>
      </head>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            gap: '24px',
            padding: '0 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Something went wrong!</h1>
          <p style={{ fontSize: '1rem', color: '#666', margin: 0, maxWidth: '480px' }}>
            We apologize for the inconvenience. Our team has been notified and is working on a fix.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px',
              fontSize: '1rem',
              backgroundColor: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
