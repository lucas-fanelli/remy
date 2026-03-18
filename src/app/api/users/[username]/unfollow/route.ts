import { NextRequest, NextResponse } from 'next/server';
import { INotificationService } from '@/domain/services/INotificationService';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const token = extractBearerToken(request);
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

    // Delete follow relationship
    const result = await prisma.follow.deleteMany({
      where: {
        followerId: payload.userId,
        followingId: userToUnfollow.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not following this user' }, { status: 400 });
    }

    // Delete the follow notification
    const notificationService = container.get<INotificationService>('INotificationService');
    await notificationService.deleteFollowNotification(payload.userId, userToUnfollow.id);

    const followersCount = await prisma.follow.count({ where: { followingId: userToUnfollow.id } });
    return NextResponse.json({ success: true, message: 'Unfollowed successfully', followersCount });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
}
