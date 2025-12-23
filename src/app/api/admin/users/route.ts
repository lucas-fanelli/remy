import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') as Role | undefined;

    const adminService = container.getAdminService();
    const result = await adminService.getAllUsers({ page, limit, search, role });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
