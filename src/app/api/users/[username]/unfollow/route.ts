import { NextRequest, NextResponse } from 'next/server';
import { INotificationService } from '@/domain/services/INotificationService';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userService = container.getUserService();
    const userToUnfollow = await userService.getUserByUsername(username);

    if (!userToUnfollow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userToUnfollow.id === payload.userId) {
      return NextResponse.json({ error: 'Cannot unfollow yourself' }, { status: 400 });
    }

    // Atomic delete + count in a single transaction
    const { deleteResult, followersCount } = await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.follow.deleteMany({
        where: {
          followerId: payload.userId,
          followingId: userToUnfollow.id,
        },
      });
      const followersCount = await tx.follow.count({
        where: { followingId: userToUnfollow.id },
      });
      return { deleteResult, followersCount };
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Not following this user' }, { status: 400 });
    }

    // Non-critical notification cleanup
    try {
      const notificationService = container.get<INotificationService>('INotificationService');
      await notificationService.deleteFollowNotification(payload.userId, userToUnfollow.id);
    } catch (notifError) {
      logServerError('Failed to delete follow notification:', notifError);
    }

    return NextResponse.json({ success: true, message: 'Unfollowed successfully', followersCount });
  } catch (error) {
    logServerError('Error unfollowing user:', error);
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
}
