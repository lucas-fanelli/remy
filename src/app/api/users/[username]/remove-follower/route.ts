import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { removeFollower } from '@/lib/follows/requests';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/users/[username]/remove-follower — the signed-in owner removes {username} from
 * THEIR OWN followers. No body.
 *
 * {username} is the follower. As with follow and unfollow next door, the path names the
 * account the action applies to, and the actor is always the session. The name avoids
 * /users/{username}/followers/..., because GET /api/users/{username}/followers is
 * {username}'s own list, and a path under it would read as removing someone from theirs.
 *
 * This is how an owner closes a private account to someone who followed it while it was
 * public: existing followers stay when an account goes private. A pending request from
 * {username} is deleted too. They are not told. To see a private account's recipes again
 * they have to ask again, and the owner has to accept.
 *
 *   200 { success: true, removed: boolean, followersCount }
 *
 * - removed: false means {username} was not following: a repeat, or they unfollowed first.
 *   That is the state asked for, so it is a 200 and a retry after a dropped response is
 *   safe. Naming yourself also gives removed: false, since nobody follows themselves.
 * - `followersCount` is the owner's, after the removal.
 * - src/lib/follows/requests.ts deletes the owner's 'follow' notification from them, after
 *   its commit, so this route notifies nobody.
 *
 * Errors: 400 request.invalidUsername; 401 unauthorized; 404 user.notFound; 500
 * user.removeFollowerFailed. Like every write under /api, the middleware refuses it without
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

    let owner;
    try {
      owner = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const follower = await container.getUserService().getUserByUsername(username);
    if (!follower) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    const { removed } = await removeFollower(prisma, owner.id, follower.id);

    const followersCount = await prisma.follow.count({ where: { followingId: owner.id } });

    return NextResponse.json({ success: true, removed, followersCount });
  } catch (error) {
    logServerError('Error removing follower:', error);
    return NextResponse.json(
      { error: 'Failed to remove follower', code: 'user.removeFollowerFailed' },
      { status: 500 }
    );
  }
}
