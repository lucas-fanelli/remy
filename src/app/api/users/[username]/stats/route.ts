import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { canViewContentOf } from '@/lib/privacy/visibility';
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

    // Optional auth — get current user if authenticated
    const token = extractAuthToken(request);
    let currentUserId: string | null = null;
    if (token) {
      try {
        const payload = await verifySessionToken(token);
        if (payload) currentUserId = payload.userId;
      } catch (error) {
        const isExpectedJwtError =
          error instanceof Error &&
          (error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError');
        if (!isExpectedJwtError) {
          logServerError('Unexpected error during token verification:', error);
        }
      }
    }

    const userService = container.getUserService();

    // Get user
    const user = await userService.getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    // The same gate as the account's recipes. The counts themselves are header, not content,
    // but nothing in the app calls this route, and opening it to everyone is a decision of
    // its own rather than a side effect of moving the rule.
    if (!(await canViewContentOf(prisma, currentUserId, user))) {
      return NextResponse.json(
        { error: 'This profile is private', code: 'user.profilePrivate' },
        { status: 403 }
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
    logServerError('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', code: 'user.statsFailed' },
      { status: 500 }
    );
  }
}
