import { Role } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
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
    const roleParam = searchParams.get('role');
    const role =
      roleParam && ['USER', 'ADMIN'].includes(roleParam) ? (roleParam as Role) : undefined;

    const adminService = container.getAdminService();
    const result = await adminService.getAllUsers({ page, limit, search, role });

    return NextResponse.json(result);
  } catch (error) {
    logServerError('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', code: 'user.fetchFailed' },
      { status: 500 }
    );
  }
}
