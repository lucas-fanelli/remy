import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';
import { extractAuthToken } from '@/lib/utils/auth';

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
