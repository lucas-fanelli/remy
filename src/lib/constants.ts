/** Shared application constants */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

export const MAX_PANTRY_ITEMS = 500;

export const MAX_COMMENT_LENGTH = 5000;

export const MAX_NOTES_LENGTH = 5000;

export const MAX_SEARCH_QUERY_LENGTH = 200;

export const MAX_ITEM_NAME_LENGTH = 200;

export const MAX_QUANTITY = 999999;

/** Username: alphanumeric + underscore, 1-30 chars */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{1,30}$/;
