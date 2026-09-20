const { withSentryConfig } = require('@sentry/nextjs');
const createNextIntlPlugin = require('next-intl/plugin');
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

// next-intl "without i18n routing": no [locale] segment, so the plugin only needs to be
// pointed at the request config that resolves the locale from the cookie.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force webpack mode - Serwist doesn't support Turbopack yet
  turbopack: {},
  // next-intl and the ICU packages underneath it publish ES modules only. Webpack copes on
  // its own, but next/jest derives its transformIgnorePatterns from THIS list, and the test
  // harness (jest.setup.js) runs the real translator - so the list is what lets jest compile
  // them. Keeping it here keeps one source of truth for both. See docs/I18N.md.
  transpilePackages: [
    'next-intl',
    'use-intl',
    'icu-minify',
    'intl-messageformat',
    '@formatjs/fast-memoize',
    '@formatjs/icu-messageformat-parser',
    '@formatjs/icu-skeleton-parser',
  ],
};

// Wrap with next-intl first (it only adds an alias + webpack rule), then Serwist, then Sentry
const configWithSerwist = withSerwist(withNextIntl(nextConfig));

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
