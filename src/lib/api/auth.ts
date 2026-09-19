import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';
import { extractAuthToken } from '@/lib/utils/auth';

export interface SessionIdentity {
  userId: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Resolve a raw session token to the identity behind it, or null.
 *
 * Use this — never a bare ITokenService verify — when the result authorizes anything.
 * A valid signature is not enough: AuthService.validateToken also loads the user
 * and rejects tokens issued before the last password change or reset, which is
 * what makes a stolen session die when the owner recovers the account.
 */
export async function verifySessionToken(token: string): Promise<SessionIdentity | null> {
  const user = await container.getAuthService().validateToken(token);
  if (!user) return null;

  return { userId: user.id, email: user.email, username: user.username, role: user.role };
}

export async function getCurrentUser(request: NextRequest) {
  const token = extractAuthToken(request);
  if (!token) return null;

  const authService = container.getAuthService();

  try {
    const user = await authService.validateToken(token);
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}
