import { NextRequest } from 'next/server';

/**
 * Extract auth token from request.
 * Checks Authorization header first, then falls back to httpOnly cookie.
 * Returns null if no valid token found.
 */
export function extractBearerToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fall back to httpOnly cookie
  const cookieToken = request.cookies.get('auth_token')?.value;
  return cookieToken || null;
}
