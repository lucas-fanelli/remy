import { getRequestConfig } from 'next-intl/server';
import { TIME_ZONE } from './config';
import { getServerLocale } from './locale';
import { getMessages } from './messages';

/**
 * next-intl "without i18n routing": there is no [locale] segment and no locale in the URL,
 * so every server render asks this for the locale instead of reading a route param.
 *
 * The time zone is pinned (see config.ts) so a date rendered on the server and re-rendered
 * on the client produce the same string.
 */
export default getRequestConfig(async () => {
  const locale = await getServerLocale();

  return {
    locale,
    messages: getMessages(locale),
    timeZone: TIME_ZONE,
  };
});
