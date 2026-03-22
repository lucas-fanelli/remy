import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import { logAuditEvent, logServerError } from '@/lib/utils/logger';

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

    logAuditEvent('ADMIN_COMMENT_DELETE', { admin: authResult.userId, target: id });

    const adminService = container.getAdminService();
    await adminService.deleteComment(id);

    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'COMMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    logServerError('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
