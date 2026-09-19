'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { isApiErrorCode, type ApiErrorCode } from './errorCodes';

/**
 * The client half of the API error contract (see errorCodes.ts).
 *
 * Rule: show the translated message when the server sent a code this build knows, and the
 * server's own English string otherwise. That fallback is what makes the migration safe -
 * a route nobody has touched yet still produces a sentence, just an English one.
 *
 * ```tsx
 * const apiErrorMessage = useApiErrorMessage();
 *
 * const response = await fetch('/api/auth/change-password', { ... });
 * const body = await response.json();
 * if (!response.ok) showError(apiErrorMessage(body, t('changePassword.failed')));
 * ```
 */

type ErrorTranslator = (key: ApiErrorCode) => string;

/** The `code` of a parsed response body, when it is one this build knows about. */
export function apiErrorCodeOf(body: unknown): ApiErrorCode | null {
  if (!body || typeof body !== 'object') return null;
  const code = (body as { code?: unknown }).code;
  return isApiErrorCode(code) ? code : null;
}

/**
 * Pure so it can be unit-tested without rendering: the hook below just binds `t` to it.
 *
 * @param fallback what to show when the server sent neither a known code nor a string -
 *                 a body that is not JSON, or a request that never got a response at all.
 */
export function translateApiError(t: ErrorTranslator, body: unknown, fallback: string): string {
  const code = apiErrorCodeOf(body);
  if (code) return t(code);

  const serverText =
    body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;

  return typeof serverText === 'string' && serverText.trim() ? serverText : fallback;
}

/** The hook components use. `fallback` defaults to the generic 'something went wrong'. */
export function useApiErrorMessage(): (body: unknown, fallback?: string) => string {
  const t = useTranslations('errors');

  return useCallback(
    (body: unknown, fallback?: string) =>
      translateApiError(t as ErrorTranslator, body, fallback ?? t('unknown')),
    [t]
  );
}
