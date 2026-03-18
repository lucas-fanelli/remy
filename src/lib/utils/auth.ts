import { NextRequest } from 'next/server';

/**
 * Extract auth token from request.
 * Prioritizes httpOnly cookie (primary auth mechanism after cookie migration),
 * then falls back to Authorization Bearer header for backward compatibility.
 * Returns null if no valid token found.
 */
export function extractBearerToken(request: NextRequest): string | null {
  // Prefer httpOnly cookie — this is the canonical auth mechanism
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization header (used during login/register before cookie is set)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
