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
 * makes sure both languages have it, and errorCodes.test.ts that the two lists agree.
 *
 * Beyond the six generic ones, a code is grouped by the part of the API that answers it
 * (`recipe.notFound`, `auth.invalidCredentials`, `upload.tooLarge`). The dot is the nesting
 * of errors.json, so `t('errors.recipe.notFound')` resolves it - the same path the client
 * helper builds from the code it received.
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

  // The shape of the request itself: a malformed id, a wrong Content-Type. Produced by the
  // guards every route shares (src/lib/utils/request.ts and the UUID_REGEX checks).
  'request.contentTypeJson',
  'request.invalidId',
  'request.invalidPostId',
  'request.invalidUserId',
  'request.invalidUsername',

  // Sessions and credentials - src/app/api/auth/** and the token guards
  'auth.invalidCredentials',
  'auth.invalidResetToken',
  'auth.invalidToken',
  'auth.required',
  'auth.sessionExpired',
  'auth.userExists',

  // src/app/api/admin/** (requireAdmin included)
  'admin.accessRequired',
  'admin.cannotDeleteLastAdmin',
  'admin.cannotDeleteSelf',
  'admin.cannotDemoteLastAdmin',
  'admin.cannotDemoteSelf',
  'admin.invalidRoleAction',
  'admin.privilegesRevoked',
  'admin.recalcFailed',
  'admin.roleUpdateFailed',
  'admin.statsFailed',

  // src/app/api/users/**
  'user.cannotFollowSelf',
  'user.cannotUnfollowSelf',
  'user.deleteFailed',
  'user.fetchFailed',
  'user.followFailed',
  'user.followersFailed',
  'user.followingFailed',
  'user.notFollowing',
  'user.notFound',
  'user.profileFailed',
  'user.profilePrivate',
  'user.statsFailed',
  'user.unfollowFailed',

  // src/app/api/recipes/**
  'recipe.createFailed',
  'recipe.dailyLimit',
  'recipe.deleteFailed',
  'recipe.deleteForbidden',
  'recipe.fetchFailed',
  'recipe.invalidDifficulty',
  'recipe.invalidSort',
  'recipe.likeFailed',
  'recipe.loadFailed',
  'recipe.matchFailed',
  'recipe.matchInProgress',
  'rating.invalid',
  'rating.removeFailed',
  'rating.saveFailed',
  'recipe.notFound',
  'recipe.savedFetchFailed',
  'recipe.saveFailed',
  'recipe.updateFailed',
  'recipe.updateForbidden',

  // src/app/api/recipes/[id]/comments/** and src/app/api/admin/comments/**
  'comment.createFailed',
  'comment.deleteFailed',
  'comment.editForbidden',
  'comment.fetchFailed',
  'comment.notFound',
  'comment.notFoundOrForbidden',
  'comment.textRequired',
  'comment.textTooLong',
  'comment.updateFailed',
  'comment.wrongRecipe',

  // src/app/api/pantry/**
  'pantry.addFailed',
  'pantry.categoryTooLong',
  'pantry.deleteFailed',
  'pantry.duplicateItem',
  'pantry.fetchFailed',
  'pantry.invalidExpiryDate',
  'pantry.itemNotFound',
  'pantry.limitReached',
  'pantry.nameEmpty',
  'pantry.nameRequired',
  'pantry.nameTooLong',
  'pantry.notesTooLong',
  'pantry.quantityInvalid',
  'pantry.quantityNegative',
  'pantry.quantityTooLarge',
  'pantry.unitEmpty',
  'pantry.unitRequired',
  'pantry.unitTooLong',
  'pantry.updateFailed',

  // src/app/api/cooked-recipes/**
  'cooked.dailyLimit',
  'cooked.fetchFailed',
  'cooked.insufficientIngredients',
  'cooked.invalidId',
  'cooked.markFailed',
  'cooked.notFound',
  'cooked.planFailed',
  'cooked.removeFailed',

  // src/app/api/notifications/**
  'notification.fetchFailed',
  'notification.markAllReadFailed',
  'notification.markReadFailed',

  // src/app/api/search/**
  'search.failed',
  'search.queryRequired',
  'search.queryTooLong',

  // src/app/api/upload/** and the Cloudinary URL guard
  'upload.avatarFailed',
  'upload.failed',
  'upload.invalidContentType',
  'upload.invalidFileContent',
  'upload.invalidFileType',
  'upload.invalidUrl',
  'upload.noFile',
  'upload.notFromApp',
  'upload.tooLarge',
  'upload.unavailable',
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
