import { NextRequest } from 'next/server';

/**
 * Extract auth token from the httpOnly cookie.
 * Returns null if no valid token found.
 */
export function extractAuthToken(request: NextRequest): string | null {
  return request.cookies.get('auth_token')?.value ?? null;
}
