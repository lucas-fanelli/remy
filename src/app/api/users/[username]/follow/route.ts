import { NextRequest, NextResponse } from 'next/server';
import { INotificationService } from '@/domain/services/INotificationService';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userService = container.getUserService();
    const userToFollow = await userService.getUserByUsername(username);

    if (!userToFollow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Can't follow yourself
    if (userToFollow.id === payload.userId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: payload.userId,
          followingId: userToFollow.id,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json({ error: 'Already following this user' }, { status: 400 });
    }

    // Atomic follow + count
    try {
      const [, followersCount] = await prisma.$transaction([
        prisma.follow.create({
          data: { followerId: payload.userId, followingId: userToFollow.id },
        }),
        prisma.follow.count({ where: { followingId: userToFollow.id } }),
      ]);

      const notificationService = container.get<INotificationService>('INotificationService');
      await notificationService.createFollowNotification(payload.userId, userToFollow.id);

      return NextResponse.json({ success: true, message: 'Followed successfully', followersCount });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        const followersCount = await prisma.follow.count({
          where: { followingId: userToFollow.id },
        });
        return NextResponse.json({ success: true, message: 'Already following', followersCount });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
  }
}
