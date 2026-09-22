import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { unfollowOrCancel } from '@/lib/follows/requests';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';
import type { FollowState } from '@/domain/types/follow';

/** The English `message`, kept for clients older than `was`. */
const MESSAGE: Record<FollowState, string> = {
  following: 'Unfollowed successfully',
  requested: 'Request cancelled',
  none: 'Not following',
};

/**
 * POST /api/users/[username]/unfollow — the signed-in user taps "Siguiendo" or "Solicitado"
 * on {username}. No body.
 *
 * Stops following, or takes back a pending request, whichever there is. `was` says which,
 * so the client can tell an unfollow, which locks a private account's recipes again, from a
 * cancelled request, which unlocks nothing that was open. A cancel that races the owner's
 * "Aceptar" removes the follow that accept just made, and answers was: 'following'. The
 * answer always matches what is left in the tables.
 *
 *   200 { success: true, state: 'none', was: 'following' | 'requested' | 'none', message,
 *         followersCount }
 *
 * - `followersCount` counts followers only, after the change.
 * - src/lib/follows/requests.ts deletes the notification that went with what was removed
 *   ('follow' or 'follow_request'), after its commit, so this route deletes none itself.
 *
 * Errors: 400 request.invalidUsername | user.cannotUnfollowSelf; 401 unauthorized |
 * auth.invalidToken; 404 user.notFound; 500 user.unfollowFailed. Like every write under
 * /api, the middleware refuses it without X-Requested-With or a same-origin Sec-Fetch-Site
 * (CSRF).
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
    const userToUnfollow = await userService.getUserByUsername(username);

    if (!userToUnfollow) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    if (userToUnfollow.id === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot unfollow yourself', code: 'user.cannotUnfollowSelf' },
        { status: 400 }
      );
    }

    // Already neither following nor asking is the state the caller asked for, so it
    // succeeds with was: 'none'. Follow has always answered 'Already following' with a
    // 200; unfollow used to answer 400, which meant a retry after a dropped response
    // surfaced as an error on a request that had in fact worked.
    const { was } = await unfollowOrCancel(prisma, payload.userId, userToUnfollow.id);

    const followersCount = await prisma.follow.count({
      where: { followingId: userToUnfollow.id },
    });

    return NextResponse.json({
      success: true,
      state: 'none',
      was,
      message: MESSAGE[was],
      followersCount,
    });
  } catch (error) {
    logServerError('Error unfollowing user:', error);
    return NextResponse.json(
      { error: 'Failed to unfollow user', code: 'user.unfollowFailed' },
      { status: 500 }
    );
  }
}
