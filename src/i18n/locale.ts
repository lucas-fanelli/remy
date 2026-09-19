import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type Locale } from './config';

/**
 * The locale of the current request, on the server.
 *
 * Reading it here (and not from the auth session) is what removes the flicker: the very
 * first HTML the browser receives is already in the right language, logged in or not.
 *
 * The middleware writes the cookie on the first visit, so from the second request on this
 * is a pure cookie read; the Accept-Language fallback only matters for the request that
 * races the middleware's Set-Cookie (and for callers that bypass the matcher).
 */
export async function getServerLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'));
}
