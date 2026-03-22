import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates that the request has a JSON Content-Type header.
 * Returns a 415 error response if invalid, or null if valid.
 *
 * IMPORTANT: This function only inspects headers — it never reads the request body.
 * Callers can safely call request.json() after this check.
 */
export function requireJsonContentType(request: NextRequest): NextResponse | null {
  const ct = request.headers.get('content-type');
  if (!ct?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  return null;
}
