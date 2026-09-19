/**
 * The one place every message file is registered.
 *
 * The imports are STATIC on purpose: the bundler resolves them, so there is no runtime
 * `import()` of a path built from a variable (which the CSP and the edge runtime dislike),
 * and a namespace that exists on disk but is not registered here fails the parity test.
 *
 * The split is one JSON per namespace per locale so that engineers migrating different
 * areas of the app in parallel never write to the same file. Adding a namespace is the
 * only reason to edit this module.
 */
import { LOCALES, type Locale } from './config';
import enAdmin from './messages/en/admin.json';
import enAuth from './messages/en/auth.json';
import enComments from './messages/en/comments.json';
import enCommon from './messages/en/common.json';
import enErrors from './messages/en/errors.json';
import enFeed from './messages/en/feed.json';
import enMetadata from './messages/en/metadata.json';
import enNav from './messages/en/nav.json';
import enNotifications from './messages/en/notifications.json';
import enPantry from './messages/en/pantry.json';
import enProfile from './messages/en/profile.json';
import enPwa from './messages/en/pwa.json';
import enRecipe from './messages/en/recipe.json';
import enRecipeForm from './messages/en/recipeForm.json';
import enRecipeParser from './messages/en/recipeParser.json';
import enSearch from './messages/en/search.json';
import enSettings from './messages/en/settings.json';
import enShell from './messages/en/shell.json';
import enUnits from './messages/en/units.json';
import enValidation from './messages/en/validation.json';
import esAdmin from './messages/es/admin.json';
import esAuth from './messages/es/auth.json';
import esComments from './messages/es/comments.json';
import esCommon from './messages/es/common.json';
import esErrors from './messages/es/errors.json';
import esFeed from './messages/es/feed.json';
import esMetadata from './messages/es/metadata.json';
import esNav from './messages/es/nav.json';
import esNotifications from './messages/es/notifications.json';
import esPantry from './messages/es/pantry.json';
import esProfile from './messages/es/profile.json';
import esPwa from './messages/es/pwa.json';
import esRecipe from './messages/es/recipe.json';
import esRecipeForm from './messages/es/recipeForm.json';
import esRecipeParser from './messages/es/recipeParser.json';
import esSearch from './messages/es/search.json';
import esSettings from './messages/es/settings.json';
import esShell from './messages/es/shell.json';
import esUnits from './messages/es/units.json';
import esValidation from './messages/es/validation.json';

/** Every namespace, in the order the docs list them. One area of the app owns each one. */
export const NAMESPACES = [
  'common',
  'nav',
  'auth',
  'settings',
  'recipeForm',
  'recipeParser',
  'recipe',
  'feed',
  'comments',
  'pantry',
  'profile',
  'notifications',
  'admin',
  'pwa',
  'errors',
  'units',
  'validation',
  'metadata',
  'search',
  'shell',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * English is the source of truth for the SHAPE of the catalogue: it is what AppConfig is
 * augmented with, so `t('nav.items.home')` is checked and a typo is a compile error.
 */
const en = {
  common: enCommon,
  nav: enNav,
  auth: enAuth,
  settings: enSettings,
  recipeForm: enRecipeForm,
  recipeParser: enRecipeParser,
  recipe: enRecipe,
  feed: enFeed,
  comments: enComments,
  pantry: enPantry,
  profile: enProfile,
  notifications: enNotifications,
  admin: enAdmin,
  pwa: enPwa,
  errors: enErrors,
  units: enUnits,
  validation: enValidation,
  metadata: enMetadata,
  search: enSearch,
  shell: enShell,
};

export type Messages = typeof en;

/**
 * Typed as `Messages`, so a namespace translated in English but not in Spanish is a
 * TypeScript error and not something that only shows up in production. The parity test
 * catches what structural typing cannot (extra Spanish keys, mismatched ICU arguments).
 */
const es: Messages = {
  common: esCommon,
  nav: esNav,
  auth: esAuth,
  settings: esSettings,
  recipeForm: esRecipeForm,
  recipeParser: esRecipeParser,
  recipe: esRecipe,
  feed: esFeed,
  comments: esComments,
  pantry: esPantry,
  profile: esProfile,
  notifications: esNotifications,
  admin: esAdmin,
  pwa: esPwa,
  errors: esErrors,
  units: esUnits,
  validation: esValidation,
  metadata: esMetadata,
  search: esSearch,
  shell: esShell,
};

const MESSAGES: Record<Locale, Messages> = { en, es };

/** The merged catalogue for one locale; every namespace is always present. */
export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** Both catalogues, for the parity test and for tooling. Not used at runtime. */
export const ALL_MESSAGES: Record<Locale, Messages> = MESSAGES;

/** Re-exported so callers that only need the list do not import two modules. */
export { LOCALES };
