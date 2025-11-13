import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';

/**
 * GET /api/notifications
 * Get all notifications for the logged-in user
 *
 * Following Clean Architecture:
 * - API Route (Presentation Layer) → Service (Business Logic) → Repository (Data Access)
 * - Dependency Injection via Container
 * - Single Responsibility: Only handles HTTP concerns
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and validate token
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use TokenService from container to verify token
    const tokenService = container.getTokenService();
    const decoded = tokenService.verify(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Use service layer to get notifications
    const notificationService = container.getNotificationService();
    const result = await notificationService.getUserNotifications(
      decoded.userId,
      limit,
      offset
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
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
    // Extract and validate token
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use TokenService from container to verify token
    const tokenService = container.getTokenService();
    const decoded = tokenService.verify(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Use service layer to mark notifications as read
    const notificationService = container.getNotificationService();
    await notificationService.markAllAsRead(decoded.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
