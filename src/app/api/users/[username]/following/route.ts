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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get following with user details
    const following = await prisma.follow.findMany({
      where: {
        followerId: user.id,
      },
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
            in: following.map(f => f.following.id),
          },
        },
        select: {
          followingId: true,
        },
      });

      followingMap = followingRelations.reduce((acc, rel) => {
        acc[rel.followingId] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    const followingList = following.map(f => ({
      ...f.following,
      isFollowing: followingMap[f.following.id] || false,
    }));

    return NextResponse.json({ following: followingList });
  } catch (error) {
    console.error('Error fetching following:', error);
    return NextResponse.json(
      { error: 'Failed to fetch following' },
      { status: 500 }
    );
  }
}
