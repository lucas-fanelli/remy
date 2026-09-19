// TODO: Create typed mock factories to reduce 'any' usage in test files
import '@testing-library/jest-dom';

// next-intl, globally, for every test file.
//
// Components call useTranslations() without a provider in ~2900 existing tests, each with
// its own render wrapper, so there is nowhere to add NextIntlClientProvider. Instead the
// module itself is replaced by bindings backed by use-intl's REAL ICU translator bound to
// the merged ENGLISH catalogue: a migrated component renders the same English text it used
// to, plurals and t.rich actually run, and a test opts into Spanish with setTestLocale /
// renderWithLocale from '@/i18n/testing'. See docs/I18N.md.
//
// next-intl and use-intl are ESM-only; `transpilePackages` in next.config.js is what makes
// next/jest compile them instead of ignoring node_modules.
// The factory runs the first time a test file reaches for next-intl, so the ~60 suites that
// render nothing translated never pay for loading use-intl and every message file.
let mockI18nHarness = null;
jest.mock('next-intl', () => {
  mockI18nHarness = require('@/i18n/testing');
  return mockI18nHarness.createNextIntlModuleMock();
});

// The server half of the same promise. A Server Component reads its messages from
// getTranslations(), whose real implementation is bound to a request and throws "not
// supported in Client Components" under jsdom - so a page with a generateMetadata would
// otherwise need a mock of its own. Same English translator, same setTestLocale opt-in.
jest.mock('next-intl/server', () => {
  mockI18nHarness = require('@/i18n/testing');
  return mockI18nHarness.createNextIntlServerModuleMock();
});

beforeEach(() => {
  // A test that switched to Spanish must not leak into the next one
  if (mockI18nHarness) mockI18nHarness.resetTestLocale();
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock URL.createObjectURL/revokeObjectURL for jsdom compatibility
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Suppress noisy console output from tests
const originalError = console.error;
const originalLog = console.log;

beforeAll(() => {
  // Suppress noisy MUI warnings
  console.error = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: An update to') ||
        message.includes('inside a test was not wrapped in act') ||
        message.includes('TouchRipple') ||
        message.includes('Error changing password:') ||
        message.includes('Error updating recipe:') ||
        message.includes('Search error:'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Suppress debug console.log statements
  console.log = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.startsWith('Navigation:')) {
      return;
    }
    originalLog.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.log = originalLog;
});
