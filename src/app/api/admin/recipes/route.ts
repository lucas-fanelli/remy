import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import { logServerError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const search = searchParams.get('search') || undefined;
    const userId = searchParams.get('userId') || undefined;

    if (userId && !UUID_REGEX.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    const adminService = container.getAdminService();
    const result = await adminService.getAllRecipes({ page, limit, search, userId });

    return NextResponse.json(result);
  } catch (error) {
    logServerError('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}
