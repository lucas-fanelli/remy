import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';

export async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const authService = container.getAuthService();

  try {
    const user = await authService.validateToken(token);
    return user;
  } catch (error) {
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
