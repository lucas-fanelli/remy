import { NextRequest, NextResponse } from 'next/server';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

/**
 * PATCH /api/notifications/[id]
 * Mark a single notification as read
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: notificationId } = await params;

    if (!UUID_REGEX.test(notificationId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const decoded = tokenService.verify(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify the notification belongs to this user and update it
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: decoded.userId,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Mark as read
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
