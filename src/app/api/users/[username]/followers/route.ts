import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { followStatesFor } from '@/lib/follows/state';
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

    // Require authentication to view follower lists
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'auth.required' },
        { status: 401 }
      );
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'auth.invalidToken' },
        { status: 401 }
      );
    }

    const currentUserId: string = payload.userId;

    // Get the user by username
    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    // Who follows an account is content, like its recipes: a private account's list goes
    // only to the viewers the rule lets in.
    if (!(await canViewContentOf(prisma, currentUserId, user))) {
      return NextResponse.json(
        { error: 'This profile is private', code: 'user.profilePrivate' },
        { status: 403 }
      );
    }

    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50') || 50)
    );
    const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0') || 0);

    // Get followers with user details and total count in parallel. Only "follows" is read:
    // a pending request is not a follower, so it is neither listed nor counted here.
    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: {
          followingId: user.id,
        },
        take: limit,
        skip: offset,
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              bio: true,
              // A row's button turns to "Solicitado", not "Siguiendo", when the viewer
              // follows a private account from here — so the page has to know which rows are.
              isPrivate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.follow.count({ where: { followingId: user.id } }),
    ]);

    // Where the viewer stands with each person listed, for the button on their row: one
    // query per table for the whole page, never one per row.
    const states = await followStatesFor(
      prisma,
      currentUserId,
      followers.map((f) => f.follower.id)
    );

    const followersList = followers.map(({ follower }) => {
      const followState = states.get(follower.id) ?? 'none';
      return {
        ...follower,
        followState,
        // What the page read before followState, kept for one release so a tab still
        // running the old bundle draws its buttons. A pending request is not a follow.
        isFollowing: followState === 'following',
      };
    });

    return NextResponse.json({ followers: followersList, total });
  } catch (error) {
    logServerError('Error fetching followers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followers', code: 'user.followersFailed' },
      { status: 500 }
    );
  }
}
