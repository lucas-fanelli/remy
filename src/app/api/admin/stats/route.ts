import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const adminService = container.getAdminService();
    const stats = await adminService.getStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
