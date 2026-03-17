import { NextRequest } from 'next/server';

/**
 * Extract Bearer token from request Authorization header.
 * Returns null if header is missing or doesn't start with "Bearer ".
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}
