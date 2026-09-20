import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { INotificationService } from '@/domain/services/INotificationService';
import { verifySessionToken } from '@/lib/api/auth';
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
      return NextResponse.json(
        { error: 'Invalid username format', code: 'request.invalidUsername' },
        { status: 400 }
      );
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifySessionToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'auth.invalidToken' },
        { status: 401 }
      );
    }

    const userService = container.getUserService();
    const userToFollow = await userService.getUserByUsername(username);

    if (!userToFollow) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    // Can't follow yourself
    if (userToFollow.id === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot follow yourself', code: 'user.cannotFollowSelf' },
        { status: 400 }
      );
    }

    // Atomic follow + count — rely on unique constraint for duplicate detection
    // instead of a separate pre-check (avoids TOCTOU race)
    try {
      const [, followersCount] = await prisma.$transaction([
        prisma.follow.create({
          data: { followerId: payload.userId, followingId: userToFollow.id },
        }),
        prisma.follow.count({ where: { followingId: userToFollow.id } }),
      ]);

      // Non-critical: don't let notification failure mask follow success
      try {
        const notificationService = container.get<INotificationService>('INotificationService');
        await notificationService.createFollowNotification(payload.userId, userToFollow.id);
      } catch (notifError) {
        logServerError('Failed to create follow notification:', notifError);
      }

      return NextResponse.json({ success: true, message: 'Followed successfully', followersCount });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const followersCount = await prisma.follow.count({
          where: { followingId: userToFollow.id },
        });
        return NextResponse.json({ success: true, message: 'Already following', followersCount });
      }
      throw err;
    }
  } catch (error) {
    logServerError('Error following user:', error);
    return NextResponse.json(
      { error: 'Failed to follow user', code: 'user.followFailed' },
      { status: 500 }
    );
  }
}
