/**
 * The machine-readable half of an API error.
 *
 * Today ~100 English sentences are spread over 41 route handlers and the client shows
 * whatever the server sent. Rewriting all of them at once would break every test that
 * asserts on those sentences, and any client already in the wild.
 *
 * So the contract is additive: the body keeps its unchanged English `error` string AND
 * gains a stable `code`. Old clients keep working; a translated client shows
 * `t('errors.<code>')` when it recognises the code and falls back to the server's string
 * when it does not. A route can therefore be migrated on its own, in any order.
 *
 *   { "error": "Current password is incorrect", "code": "currentPasswordIncorrect" }
 *
 * Codes are camelCase and match a key of the `errors` namespace one-to-one. Adding one
 * means adding it here AND to src/i18n/messages/{en,es}/errors.json - the parity test then
 * makes sure both languages have it.
 */

export const API_ERROR_CODES = [
  // Generic, seeded for every route
  'unauthorized',
  'forbidden',
  'notFound',
  'rateLimited',
  'invalidRequest',
  'serverError',
  // Specific, added by the route that needs them
  'currentPasswordIncorrect',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}

/** The shape every error response has. `code` is absent on routes not migrated yet. */
export interface ApiErrorBody {
  error?: string;
  code?: ApiErrorCode;
}
