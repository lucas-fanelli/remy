import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';

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

    const adminService = container.getAdminService();
    await adminService.deleteComment(id);

    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
