import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { acceptRequest } from '@/lib/follows/requests';
import { followStateOf } from '@/lib/follows/state';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/follow-requests/[username]/accept — the signed-in owner accepts {username}'s
 * request to follow them. {username} is the requester; the owner is always the session.
 * No body.
 *
 *   200 { success: true, result: 'accepted' | 'alreadyFollowing', followersCount, pendingCount }
 *
 * - 'accepted': the request became a follow, which opens a private account's recipes to
 *   {username}. src/lib/follows/requests.ts removes the owner's "quiere seguirte" and tells
 *   {username} "aceptó tu solicitud", after its commit, so this route notifies nobody.
 * - 'alreadyFollowing': there was no request, because {username} already follows. That is
 *   a repeat, a second tab, or the account going public, which accepts every request. The
 *   owner's wish holds, so this is a 200, and nothing is written or sent a second time.
 * - With neither a request nor a follow (the requester cancelled, the owner declined, or it
 *   was never sent), there is nothing to accept: 404 followRequest.notFound. The inbox drops
 *   the row and says "Esta solicitud ya no está".
 * - `followersCount` and `pendingCount` are the owner's own, after the accept, so the profile
 *   header and the pinned count can update from the answer.
 *
 * Errors: 400 request.invalidUsername; 401 unauthorized; 404 user.notFound |
 * followRequest.notFound; 500 followRequest.acceptFailed. Like every write under /api, the
 * middleware refuses it without X-Requested-With or a same-origin Sec-Fetch-Site (CSRF).
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

    let owner;
    try {
      owner = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const requester = await container.getUserService().getUserByUsername(username);
    if (!requester) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    const { accepted } = await acceptRequest(prisma, owner.id, requester.id);

    // Nothing was pending. Whether that is a success depends on why: the request may
    // already have become a follow.
    if (!accepted && (await followStateOf(prisma, requester.id, owner.id)) !== 'following') {
      return NextResponse.json(
        { error: 'Follow request not found', code: 'followRequest.notFound' },
        { status: 404 }
      );
    }

    const [followersCount, pendingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: owner.id } }),
      prisma.followRequest.count({ where: { targetId: owner.id } }),
    ]);

    return NextResponse.json({
      success: true,
      result: accepted ? 'accepted' : 'alreadyFollowing',
      followersCount,
      pendingCount,
    });
  } catch (error) {
    logServerError('Error accepting follow request:', error);
    return NextResponse.json(
      { error: 'Failed to accept follow request', code: 'followRequest.acceptFailed' },
      { status: 500 }
    );
  }
}
