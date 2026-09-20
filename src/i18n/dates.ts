import { enUS, es } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import type { Locale } from './config';
import type { Locale as DateFnsLocale } from 'date-fns';

/**
 * Dates and relative times.
 *
 * Prefer next-intl's useFormatter(): it needs no extra import, it already knows the locale
 * and the pinned time zone, and it covers dates, times, relative times, numbers and lists.
 *
 * ```tsx
 * const format = useFormatter();
 * format.dateTime(recipe.createdAt, { dateStyle: 'medium' });
 * format.relativeTime(comment.createdAt, now);   // `now` from useNow() keeps it live
 * format.number(recipe.servings);
 * ```
 *
 * Three components already use date-fns (notifications, the notification dropdown, comments).
 * They do not have to be rewritten - they just have to stop formatting in English:
 *
 * ```tsx
 * const locale = useDateFnsLocale();
 * formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale });
 * ```
 */

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = {
  // date-fns names its English locale after the territory; the app's English copy is US English
  en: enUS,
  es,
};

/** The date-fns locale matching the language the app is currently rendering in. */
export function useDateFnsLocale(): DateFnsLocale {
  return DATE_FNS_LOCALES[useLocale()];
}

/** For the rare non-component caller that already knows the locale. */
export function dateFnsLocaleFor(locale: Locale): DateFnsLocale {
  return DATE_FNS_LOCALES[locale];
}
