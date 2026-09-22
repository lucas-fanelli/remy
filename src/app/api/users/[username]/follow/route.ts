import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { FollowError, followOrRequest } from '@/lib/follows/requests';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';

/** The English `message`, kept for clients older than `state`. */
const MESSAGE = {
  following: { created: 'Followed successfully', repeat: 'Already following' },
  requested: { created: 'Follow request sent', repeat: 'Already requested' },
} as const;

/**
 * Every code FollowError can carry, and its status. Typed as a Record so a new code there
 * fails the typecheck here instead of answering with no status.
 */
const FOLLOW_ERROR_STATUS: Record<FollowError['code'], number> = {
  'user.cannotFollowSelf': 400,
  // Either account was deleted after this route read it
  'user.notFound': 404,
};

/**
 * POST /api/users/[username]/follow — the signed-in user taps "Seguir" on {username}. No body.
 *
 * A public account is followed at once. A private one gets a request that waits for its
 * owner to accept it ("Solicitado"), and until then opens nothing. `state` says which of the
 * two happened, and the button paints it rather than its own guess: the account may have
 * changed privacy between the page load and the tap.
 *
 *   200 { success: true, state: 'following' | 'requested', message, followersCount }
 *
 * - Someone who already follows a private account — from before it went private, or
 *   accepted since — stays a follower: 'following', and nothing is written.
 * - `followersCount` counts followers only, so a request never moves it.
 * - Idempotent: a repeat answers the same state and writes nothing, with no second row and
 *   no second notification. src/lib/follows/requests.ts sends the notifications — 'follow'
 *   or 'follow_request' — once, after its commit, so this route sends none of its own.
 * - Tapping "Solicitado" again takes the request back; that is the unfollow route.
 *
 * Errors: 400 request.invalidUsername | user.cannotFollowSelf; 401 unauthorized |
 * auth.invalidToken; 404 user.notFound, also when the account is deleted mid-request;
 * 500 user.followFailed. Like every write under /api, the middleware refuses it without
 * X-Requested-With or a same-origin Sec-Fetch-Site (CSRF).
 */
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

    // followOrRequest refuses this too; answering here spares a tap on your own profile a
    // transaction and its two locks.
    if (userToFollow.id === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot follow yourself', code: 'user.cannotFollowSelf' },
        { status: 400 }
      );
    }

    // isPrivate as read just now. If it went stale, followOrRequest settles it under its
    // lock: a stale "private" is read again there, so a request is never left waiting on
    // an account that has gone public.
    const { state, created } = await followOrRequest(prisma, payload.userId, {
      id: userToFollow.id,
      isPrivate: userToFollow.isPrivate,
    });

    // Counted after the commit, and from "follows" alone: a pending request is not a follower.
    const followersCount = await prisma.follow.count({ where: { followingId: userToFollow.id } });

    return NextResponse.json({
      success: true,
      state,
      message: MESSAGE[state][created ? 'created' : 'repeat'],
      followersCount,
    });
  } catch (error) {
    if (error instanceof FollowError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: FOLLOW_ERROR_STATUS[error.code] }
      );
    }
    logServerError('Error following user:', error);
    return NextResponse.json(
      { error: 'Failed to follow user', code: 'user.followFailed' },
      { status: 500 }
    );
  }
}
