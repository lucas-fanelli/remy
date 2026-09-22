import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { declineRequest } from '@/lib/follows/requests';
import { followStateOf } from '@/lib/follows/state';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/follow-requests/[username]/decline — the signed-in owner declines {username}'s
 * request to follow them. {username} is the requester; the owner is always the session.
 * No body.
 *
 *   200 { success: true, declined: boolean, pendingCount }
 *
 * - The requester is not told, and may ask again at once.
 * - Declining only ever deletes a pending request. It never removes someone who already
 *   follows; that is POST /api/users/{username}/remove-follower.
 * - declined: false means there was no request and {username} does not follow: a repeat,
 *   or the requester took it back first. Either way the end state is what declining wanted,
 *   so it is a 200 and a retry after a dropped response is safe.
 * - When the request is gone because it became a follow (accepted in another tab, or by
 *   going public), a 200 would tell the owner they declined someone who now follows them.
 *   That is a 404 followRequest.notFound instead, as for accept. The inbox's "Esta
 *   solicitud ya no está" is then true, and the follower shows in the owner's list.
 * - `pendingCount` is the owner's, after the decline, for the pinned count.
 *
 * Errors: 400 request.invalidUsername; 401 unauthorized; 404 user.notFound |
 * followRequest.notFound; 500 followRequest.declineFailed. Like every write under /api, the
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

    const { declined } = await declineRequest(prisma, owner.id, requester.id);

    if (!declined && (await followStateOf(prisma, requester.id, owner.id)) === 'following') {
      return NextResponse.json(
        { error: 'Follow request not found', code: 'followRequest.notFound' },
        { status: 404 }
      );
    }

    const pendingCount = await prisma.followRequest.count({ where: { targetId: owner.id } });

    return NextResponse.json({ success: true, declined, pendingCount });
  } catch (error) {
    logServerError('Error declining follow request:', error);
    return NextResponse.json(
      { error: 'Failed to decline follow request', code: 'followRequest.declineFailed' },
      { status: 500 }
    );
  }
}
