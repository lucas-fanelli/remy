import { NextRequest, NextResponse } from 'next/server';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    // Require authentication to view following lists
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const currentUserId: string = payload.userId;

    // Get the user by username
    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Privacy check
    if (user.isPrivate && currentUserId !== user.id) {
      return NextResponse.json({ error: 'This profile is private' }, { status: 403 });
    }

    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50') || 50)
    );
    const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0') || 0);

    // Get following with user details and total count in parallel
    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: {
          followerId: user.id,
        },
        take: limit,
        skip: offset,
        include: {
          following: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              bio: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    // If user is logged in, check which people they are following
    let followingMap: Record<string, boolean> = {};
    if (currentUserId) {
      const followingRelations = await prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: {
            in: following.map((f) => f.following.id),
          },
        },
        select: {
          followingId: true,
        },
      });

      followingMap = followingRelations.reduce(
        (acc, rel) => {
          acc[rel.followingId] = true;
          return acc;
        },
        {} as Record<string, boolean>
      );
    }

    const followingList = following.map((f) => ({
      ...f.following,
      isFollowing: followingMap[f.following.id] || false,
    }));

    return NextResponse.json({ following: followingList, total });
  } catch (error) {
    logServerError('Error fetching following:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
