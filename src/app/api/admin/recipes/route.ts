import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { container } from '@/lib/container/container';

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
    const userId = searchParams.get('userId') || undefined;

    const adminService = container.getAdminService();
    const result = await adminService.getAllRecipes({ page, limit, search, userId });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}
