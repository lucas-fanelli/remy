import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';

/**
 * PATCH /api/notifications/[id]
 * Mark a single notification as read
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: notificationId } = await params;

    if (!UUID_REGEX.test(notificationId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Atomic ownership check + update in a single query.
    // Combines findFirst + update into updateMany with compound where to avoid TOCTOU races.
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: user.id, isRead: false },
      data: { isRead: true },
    });

    if (result.count === 0) {
      // Could be not found, not owned, or already read - return success for idempotency
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
