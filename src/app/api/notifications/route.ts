import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';
/**
 * GET /api/notifications
 * Get all notifications for the logged-in user, and pendingRequestsCount: how many follow
 * requests are waiting on their answer
 *
 * Following Clean Architecture:
 * - API Route (Presentation Layer) → Service (Business Logic) → Repository (Data Access)
 * - Dependency Injection via Container
 * - Single Responsibility: Only handles HTTP concerns
 */
export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    // Use service layer to get notifications. The pending follow requests ride along because
    // the navigation already polls this route: the badge costs one indexed count, not a
    // second request. They are counted in "follow_requests" itself, never in the
    // notifications: a notification is only the doorbell, and reading it, or marking
    // everything read, answers no request.
    const notificationService = container.getNotificationService();
    const [result, pendingRequestsCount] = await Promise.all([
      notificationService.getUserNotifications(user.id, limit, offset),
      prisma.followRequest.count({ where: { targetId: user.id } }),
    ]);

    return NextResponse.json({ ...result, pendingRequestsCount });
  } catch (error) {
    logServerError('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', code: 'notification.fetchFailed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Mark all notifications as read for the logged-in user
 */
export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // Use service layer to mark notifications as read
    const notificationService = container.getNotificationService();
    await notificationService.markAllAsRead(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read', code: 'notification.markAllReadFailed' },
      { status: 500 }
    );
  }
}
