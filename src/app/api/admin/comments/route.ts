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
    const postId = searchParams.get('postId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    if (postId && !UUID_REGEX.test(postId)) {
      return NextResponse.json(
        { error: 'Invalid postId format', code: 'request.invalidPostId' },
        { status: 400 }
      );
    }
    if (userId && !UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format', code: 'request.invalidUserId' },
        { status: 400 }
      );
    }

    const adminService = container.getAdminService();
    const result = await adminService.getAllComments({ page, limit, postId, userId });

    return NextResponse.json(result);
  } catch (error) {
    logServerError('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments', code: 'comment.fetchFailed' },
      { status: 500 }
    );
  }
}
