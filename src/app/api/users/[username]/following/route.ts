import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get authorization token (optional for viewing following)
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader) {
      const token = authHeader.substring(7);
      const tokenService = container.getTokenService();
      const payload = tokenService.verify(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    // Get the user by username
    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50') || 50)
    );
    const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0') || 0);

    // Get following with user details
    const following = await prisma.follow.findMany({
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
    });

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

    return NextResponse.json({ following: followingList });
  } catch (error) {
    console.error('Error fetching following:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
