import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const adminService = container.getAdminService();
    await adminService.deleteRecipe(id);

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    console.error('Error deleting recipe:', error);
    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 });
  }
}
