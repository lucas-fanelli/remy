/**
 * Type-safety for every `t('...')` call in the app.
 *
 * Augmenting next-intl's AppConfig with the merged ENGLISH catalogue makes a key that does
 * not exist a compile error, gives autocomplete on namespaces and keys, and types the ICU
 * arguments of each message. English is the reference shape; Spanish is kept in step by the
 * `Messages` annotation in messages.ts and by the parity test.
 */
import type { Locale } from './config';
import type { Messages } from './messages';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
