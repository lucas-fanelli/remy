import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { extractAuthToken } from '@/lib/utils/auth';

export interface AdminAuthResult {
  userId: string;
  email: string;
  username: string;
  role: string;
  isAdmin: boolean;
}

/**
 * Middleware to verify admin access from JWT token.
 * Returns admin user info if authorized, or NextResponse with error if not.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult | NextResponse> {
  const token = extractAuthToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // validateToken checks the signature, loads the user from the DB and rejects
    // sessions issued before the last password change, so a stolen admin session
    // dies with a password reset.
    const user = await container.getAuthService().validateToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Current role from the DB row (the JWT role claim could be stale after demotion)
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isAdmin: true,
    };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}

/**
 * Helper to check if the result is an error response
 */
export function isAdminAuthError(result: AdminAuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
