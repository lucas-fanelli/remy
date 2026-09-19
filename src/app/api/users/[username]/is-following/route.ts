import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
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
      return NextResponse.json(
        { error: 'Invalid username format', code: 'request.invalidUsername' },
        { status: 400 }
      );
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ isFollowing: false });
    }

    const payload = await verifySessionToken(token);

    if (!payload) {
      return NextResponse.json({ isFollowing: false });
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    // Check if following
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: payload.userId,
          followingId: user.id,
        },
      },
    });

    return NextResponse.json({ isFollowing: !!follow });
  } catch (error) {
    logServerError('Error checking follow status:', error);
    return NextResponse.json({ isFollowing: false });
  }
}
