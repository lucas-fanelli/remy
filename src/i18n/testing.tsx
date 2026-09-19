/**
 * The i18n test harness.
 *
 * ~2900 existing tests query the UI by ENGLISH text and each renders its component with its
 * own wrapper, so there is no single place to add a provider. Instead jest.setup.js replaces
 * the `next-intl` module globally with the bindings built here: a REAL translator (use-intl's
 * ICU engine, the same one production runs) bound to the merged ENGLISH catalogue.
 *
 * The consequences are the ones we want:
 *  - a component that moves a literal into `t('...')` keeps rendering the same English text,
 *    so its existing assertions keep passing without being rewritten;
 *  - plurals, interpolation and `t.rich` really run, so a broken ICU message fails a test;
 *  - a test that cares about Spanish opts in with `renderWithLocale` or `setTestLocale`.
 *
 * This module is imported by jest.setup.js and by tests. It must not be imported by
 * production code.
 */
import React from 'react';
import { createFormatter, createTranslator } from 'use-intl/core';
import { DEFAULT_LOCALE, TIME_ZONE, type Locale } from './config';
import { getMessages } from './messages';

/**
 * English, not the app's Spanish default: the existing suite was written against the English
 * literals, and keeping them passing untouched is the whole point of this harness.
 */
export const TEST_DEFAULT_LOCALE: Locale = 'en';

let currentLocale: Locale = TEST_DEFAULT_LOCALE;

/**
 * What useNow() answers. It has to be STABLE across renders - that is what the real hook
 * does when no update interval is configured - or a component with `[now]` in a dependency
 * array would re-render forever. jest.setup.js takes a fresh one before each test.
 */
let currentNow = new Date();

/** The locale every `useTranslations()` in the current test resolves against. */
export function getTestLocale(): Locale {
  return currentLocale;
}

/**
 * Switches the whole test file (or a single test) to another language. Call it in a
 * `beforeEach`, and remember that jest.setup.js resets it to English before every test.
 */
export function setTestLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Back to English, with a fresh 'now'. jest.setup.js calls this before every test. */
export function resetTestLocale(): void {
  currentLocale = TEST_DEFAULT_LOCALE;
  currentNow = new Date();
}

/**
 * The namespace arrives as a runtime string (whatever component is rendering asked for it),
 * while createTranslator's types want a literal key of the catalogue - so the boundary is
 * cast. It costs nothing: every `t('...')` in a test is typed by the REAL next-intl types,
 * because tests import `next-intl` and only its runtime is swapped.
 */
type TestTranslator = ReturnType<typeof createTranslator> & {
  (key: string, values?: Record<string, unknown>): string;
  rich: (key: string, values?: Record<string, unknown>) => React.ReactNode;
};

/**
 * One translator per (locale, namespace) pair. Building one is not free and components call
 * `useTranslations()` on every render; the cache keeps a big suite fast.
 */
const translators = new Map<string, TestTranslator>();

export function getTestTranslator(
  namespace?: string,
  locale: Locale = currentLocale
): TestTranslator {
  const cacheKey = `${locale}:${namespace ?? ''}`;
  const cached = translators.get(cacheKey);
  if (cached) return cached;

  const translator = createTranslator({
    locale,
    messages: getMessages(locale),
    namespace,
    // A missing key must not crash the render of a not-yet-migrated component: use-intl's
    // default behaviour already returns the key path, which shows up in the assertion.
    onError: () => {},
  } as Parameters<typeof createTranslator>[0]) as TestTranslator;

  translators.set(cacheKey, translator);
  return translator;
}

const formatters = new Map<string, ReturnType<typeof createFormatter>>();

export function getTestFormatter(locale: Locale = currentLocale) {
  const cached = formatters.get(locale);
  if (cached) return cached;

  const formatter = createFormatter({ locale, timeZone: TIME_ZONE });
  formatters.set(locale, formatter);
  return formatter;
}

/**
 * The module object jest.setup.js hands back for `next-intl`. Everything a client component
 * can import from it is here; server-only entry points (`next-intl/server`) are mocked
 * separately by the few tests that need them.
 */
export function createNextIntlModuleMock() {
  return {
    useTranslations: (namespace?: string) => getTestTranslator(namespace),
    useLocale: () => currentLocale,
    useFormatter: () => getTestFormatter(),
    useNow: () => currentNow,
    useTimeZone: () => TIME_ZONE,
    useMessages: () => getMessages(currentLocale),
    // The provider is a pass-through: the translator above is already bound to the locale,
    // so nesting a provider in a test changes nothing unless setTestLocale is used.
    NextIntlClientProvider: ({ children }: { children?: React.ReactNode }) => (
      <React.Fragment>{children}</React.Fragment>
    ),
    createTranslator,
    createFormatter,
  };
}

/**
 * Renders `ui` with every `useTranslations()` bound to `locale`, and puts the locale back
 * afterwards. `render` is injected so this module does not depend on @testing-library/react
 * (it is imported by jest.setup.js, which runs before the testing library is configured).
 *
 * ```tsx
 * import { render } from '@testing-library/react';
 * import { renderWithLocale } from '@/i18n/testing';
 *
 * renderWithLocale(render, 'es', <Navigation />);
 * expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
 * ```
 */
export function renderWithLocale<T>(
  render: (ui: React.ReactElement) => T,
  locale: Locale,
  ui: React.ReactElement
): T {
  // The locale stays set for the rest of the test on purpose: a re-render triggered later
  // (an event handler, a resolved promise) must produce the same language as the first
  // paint. jest.setup.js puts it back to English before the next test.
  setTestLocale(locale);
  return render(ui);
}

/** The app's real default, for the rare test that asserts on it. */
export { DEFAULT_LOCALE };
