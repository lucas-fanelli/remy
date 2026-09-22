/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * POST /api/users/[username]/remove-follower — the owner removes {username} from their own
 * followers (S6). The write is src/lib/follows/requests.ts' removeFollower, tested there;
 * these pin that the owner is the session and {username} the follower, never the other way
 * round, and that "not a follower" is the state asked for, not an error.
 */

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { follow: { count: jest.fn() } },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

const mockGetUserByUsername = jest.fn();
jest.mock('@/lib/container/container', () => ({
  container: { getUserService: () => ({ getUserByUsername: mockGetUserByUsername }) },
}));

jest.mock('@/lib/follows/requests', () => ({ removeFollower: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { removeFollower } from '@/lib/follows/requests';
import { POST } from '../users/[username]/remove-follower/route';

const OWNER_ID = 'owner-1';
const FOLLOWER = { id: 'follower-1', username: 'fan' };

function remove(username = FOLLOWER.username): Promise<Response> {
  const request = new NextRequest(`http://localhost:3000/api/users/${username}/remove-follower`, {
    method: 'POST',
  });
  return POST(request, { params: Promise.resolve({ username }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: OWNER_ID, username: 'chef' });
  mockGetUserByUsername.mockResolvedValue(FOLLOWER);
  (prisma.follow.count as jest.Mock).mockResolvedValue(4);
});

describe('POST /api/users/[username]/remove-follower', () => {
  it("removes {username} from the signed-in owner's followers and answers the owner's count", async () => {
    (removeFollower as jest.Mock).mockResolvedValue({ removed: true });

    const response = await remove();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, removed: true, followersCount: 4 });
    // Owner first, follower second: swapped, it would remove the owner from the fan's list
    expect(removeFollower).toHaveBeenCalledWith(prisma, OWNER_ID, FOLLOWER.id);
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followingId: OWNER_ID } });
  });

  it('succeeds with removed: false when they were not following', async () => {
    // A repeat, or they unfollowed first: not a follower is what was asked for
    (removeFollower as jest.Mock).mockResolvedValue({ removed: false });

    const response = await remove();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, removed: false, followersCount: 4 });
  });

  it('rejects a malformed username', async () => {
    const response = await remove('a');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'request.invalidUsername' });
    expect(removeFollower).not.toHaveBeenCalled();
  });

  it('asks for a session', async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));

    const response = await remove();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'unauthorized' });
    expect(removeFollower).not.toHaveBeenCalled();
  });

  it('answers 404 user.notFound for an account that does not exist', async () => {
    mockGetUserByUsername.mockResolvedValue(null);

    const response = await remove();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
    expect(removeFollower).not.toHaveBeenCalled();
  });

  it('answers 500 user.removeFollowerFailed when the write fails', async () => {
    (removeFollower as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await remove();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to remove follower',
      code: 'user.removeFollowerFailed',
    });
  });
});
