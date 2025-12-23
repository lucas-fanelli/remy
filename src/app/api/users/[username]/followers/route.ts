import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get authorization token (optional for viewing followers)
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
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

    // Get followers with user details
    const followers = await prisma.follow.findMany({
      where: {
        followingId: user.id,
      },
      include: {
        follower: {
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

    // If user is logged in, check which followers they are following
    let followingMap: Record<string, boolean> = {};
    if (currentUserId) {
      const followingRelations = await prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: {
            in: followers.map((f) => f.follower.id),
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

    const followersList = followers.map((f) => ({
      ...f.follower,
      isFollowing: followingMap[f.follower.id] || false,
    }));

    return NextResponse.json({ followers: followersList });
  } catch (error) {
    console.error('Error fetching followers:', error);
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 });
  }
}
