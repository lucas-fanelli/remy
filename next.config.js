const { withSentryConfig } = require('@sentry/nextjs');
let withSerwist;
try {
  withSerwist = require('@serwist/next').default({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
    // Only disable service worker in dev server mode, not during production build
    disable: false,
  });
} catch {
  // @serwist/next is ESM-only; when loaded via require() (e.g. from jest/next-jest)
  // fall through to a no-op wrapper so the test runner can proceed.
  withSerwist = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force webpack mode - Serwist doesn't support Turbopack yet
  turbopack: {},
};

// Wrap with Serwist first, then Sentry
const configWithSerwist = withSerwist(nextConfig);

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project from Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // An auth token is required for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in production
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,
};

// Export wrapped config (Sentry is optional - works without env vars)
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithSerwist, sentryWebpackPluginOptions)
  : configWithSerwist;
