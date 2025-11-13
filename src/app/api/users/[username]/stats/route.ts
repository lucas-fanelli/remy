import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const userService = container.getUserService();

    // Get user
    const user = await userService.getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get stats
    const [recipesCount, followersCount, followingCount] = await Promise.all([
      prisma.post.count({ where: { userId: user.id } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    return NextResponse.json({
      recipesCount,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
