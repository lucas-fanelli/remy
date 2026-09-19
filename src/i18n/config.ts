/**
 * Locale configuration shared by the server (request config, middleware) and the client
 * (language switcher). It must stay dependency-free: the middleware runs on the edge runtime.
 *
 * The locale is NOT part of the URL and NOT part of the auth session. It lives in one cookie
 * that the server reads, so the very first HTML is already in the right language.
 */

export const LOCALES = ['es', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Used when there is neither a cookie nor an Accept-Language header (the audience is Argentine) */
export const DEFAULT_LOCALE: Locale = 'es';

/** Readable by client code on purpose (not httpOnly): the language switcher writes it */
export const LOCALE_COOKIE = 'remy_locale';

/** One year, in seconds */
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** How each language names itself in the switcher; never translated */
export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

/** OpenGraph wants a territory; rioplatense Spanish and US English are what the copy is written in */
export const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  es: 'es_AR',
  en: 'en_US',
};

/**
 * Dates are formatted in one fixed zone so the server render and the hydrated client agree
 * (a mismatch would re-render the text, which is the flicker this module exists to remove).
 */
export const TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Accept-Language negotiation: any Spanish variant the browser accepts ('es', 'es-AR',
 * 'es-419'...) means Spanish, any other header means English, no header means the default.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage || !acceptLanguage.trim()) return DEFAULT_LOCALE;

  const acceptsSpanish = acceptLanguage.split(',').some((entry) => {
    const [tag, ...params] = entry.trim().toLowerCase().split(';');
    const refused = params.some((param) => /^q=0(\.0*)?$/.test(param.trim()));
    return !refused && (tag === 'es' || tag.startsWith('es-'));
  });

  return acceptsSpanish ? 'es' : 'en';
}

/** Resolution order: the locale cookie, then Accept-Language, then the default */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined
): Locale {
  return isLocale(cookieValue) ? cookieValue : negotiateLocale(acceptLanguage);
}
