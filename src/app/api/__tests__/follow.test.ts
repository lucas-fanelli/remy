/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * POST /api/users/[username]/follow and /unfollow — "Seguir", "Solicitado", "Siguiendo".
 *
 * Both routes hand the write to src/lib/follows/requests.ts, whose own tests cover the locks,
 * the delete order and the notifications. What these pin is the route's half: what it
 * passes in, how it answers with what comes back, and that it no longer writes a follow or
 * sends a notification itself. Before S3, follow created the row at once, private account
 * or not, and each route sent its own 'follow' notification. The notifications unique index
 * cannot dedupe a follow-type row (its postId is NULL), so a route and the module both
 * sending one would store two.
 */

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { follow: { count: jest.fn() } },
}));

jest.mock('@/lib/api/auth', () => ({ verifySessionToken: jest.fn() }));

const mockGetUserByUsername = jest.fn();
const mockNotifications = {
  createFollowNotification: jest.fn(),
  deleteFollowNotification: jest.fn(),
};
jest.mock('@/lib/container/container', () => ({
  container: {
    getUserService: () => ({ getUserByUsername: mockGetUserByUsername }),
    get: () => mockNotifications,
    getNotificationService: () => mockNotifications,
  },
}));

// The writers are the module's; FollowError stays real, because the route maps it by class.
jest.mock('@/lib/follows/requests', () => ({
  FollowError: jest.requireActual('@/lib/follows/requests').FollowError,
  followOrRequest: jest.fn(),
  unfollowOrCancel: jest.fn(),
}));

import { verifySessionToken } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { FollowError, followOrRequest, unfollowOrCancel } from '@/lib/follows/requests';
import { POST as followPOST } from '../users/[username]/follow/route';
import { POST as unfollowPOST } from '../users/[username]/unfollow/route';

const ME = 'viewer-1';
const TARGET_ID = 'target-1';

/** The account as UserService.getUserByUsername returns it (no password). */
function account(isPrivate: boolean) {
  return {
    id: TARGET_ID,
    email: 'chef@example.com',
    username: 'chef',
    fullName: 'Chef',
    bio: null,
    avatar: null,
    website: null,
    isPrivate,
    isVerified: false,
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) => Promise<Response>;

/** A POST to `route` for {username}, signed in unless `signedIn` is false. */
function post(route: Handler, username = 'chef', { signedIn = true } = {}): Promise<Response> {
  const request = new NextRequest(`http://localhost:3000/api/users/${username}/x`, {
    method: 'POST',
    headers: signedIn ? { cookie: 'auth_token=session' } : {},
  });
  return route(request, { params: Promise.resolve({ username }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifySessionToken as jest.Mock).mockResolvedValue({ userId: ME });
  mockGetUserByUsername.mockResolvedValue(account(false));
  (prisma.follow.count as jest.Mock).mockResolvedValue(7);
});

afterEach(() => {
  // The module sends the notifications; a route that sent one too would store it twice.
  expect(mockNotifications.createFollowNotification).not.toHaveBeenCalled();
  expect(mockNotifications.deleteFollowNotification).not.toHaveBeenCalled();
});

describe('POST /api/users/[username]/follow', () => {
  it('follows a public account at once, and counts its followers from follows only', async () => {
    (followOrRequest as jest.Mock).mockResolvedValue({ state: 'following', created: true });

    const response = await post(followPOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      state: 'following',
      message: 'Followed successfully',
      followersCount: 7,
    });
    expect(followOrRequest).toHaveBeenCalledWith(prisma, ME, { id: TARGET_ID, isPrivate: false });
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followingId: TARGET_ID } });
  });

  it('asks a private account instead, and says so, with the follower count unmoved', async () => {
    mockGetUserByUsername.mockResolvedValue(account(true));
    (followOrRequest as jest.Mock).mockResolvedValue({ state: 'requested', created: true });

    const response = await post(followPOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      state: 'requested',
      message: 'Follow request sent',
      followersCount: 7,
    });
    // The module is told the account is private, so it reads that again under its lock
    expect(followOrRequest).toHaveBeenCalledWith(prisma, ME, { id: TARGET_ID, isPrivate: true });
  });

  it.each([
    ['following', 'Already following'],
    ['requested', 'Already requested'],
  ])('answers a repeat with the same state (%s), as a success', async (state, message) => {
    (followOrRequest as jest.Mock).mockResolvedValue({ state, created: false });

    const response = await post(followPOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, state, message });
  });

  it('answers with the state the module reached, not the one the account row suggested', async () => {
    // The account went public after the route read it: the module made a follow, not a request
    mockGetUserByUsername.mockResolvedValue(account(true));
    (followOrRequest as jest.Mock).mockResolvedValue({ state: 'following', created: true });

    const response = await post(followPOST);

    expect(await response.json()).toMatchObject({ state: 'following' });
  });

  it('refuses to follow yourself before opening a transaction', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue({ userId: TARGET_ID });

    const response = await post(followPOST);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Cannot follow yourself',
      code: 'user.cannotFollowSelf',
    });
    expect(followOrRequest).not.toHaveBeenCalled();
  });

  it('answers 404 when the account is deleted while the follow is being made', async () => {
    (followOrRequest as jest.Mock).mockRejectedValue(
      new FollowError('user.notFound', 'User not found')
    );

    const response = await post(followPOST);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
  });

  it("maps the module's own refusal of yourself to a 400", async () => {
    (followOrRequest as jest.Mock).mockRejectedValue(
      new FollowError('user.cannotFollowSelf', 'Cannot follow yourself')
    );

    const response = await post(followPOST);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Cannot follow yourself',
      code: 'user.cannotFollowSelf',
    });
  });

  it('answers 500 user.followFailed when anything else fails', async () => {
    (followOrRequest as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await post(followPOST);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to follow user',
      code: 'user.followFailed',
    });
  });
});

describe('POST /api/users/[username]/unfollow', () => {
  it.each([
    ['following', 'Unfollowed successfully'],
    ['requested', 'Request cancelled'],
    ['none', 'Not following'],
  ])('says what it undid (was: %s), and always ends at none', async (was, message) => {
    (unfollowOrCancel as jest.Mock).mockResolvedValue({ was });

    const response = await post(unfollowPOST);

    // 'none' too: neither following nor asking is what the tap asked for, so a retry after
    // a dropped response is not an error
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      state: 'none',
      was,
      message,
      followersCount: 7,
    });
    expect(unfollowOrCancel).toHaveBeenCalledWith(prisma, ME, TARGET_ID);
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followingId: TARGET_ID } });
  });

  it('refuses to unfollow yourself', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue({ userId: TARGET_ID });

    const response = await post(unfollowPOST);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Cannot unfollow yourself',
      code: 'user.cannotUnfollowSelf',
    });
    expect(unfollowOrCancel).not.toHaveBeenCalled();
  });

  it('answers 500 user.unfollowFailed when the write fails', async () => {
    (unfollowOrCancel as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await post(unfollowPOST);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to unfollow user',
      code: 'user.unfollowFailed',
    });
  });
});

describe.each([
  ['follow', followPOST, followOrRequest],
  ['unfollow', unfollowPOST, unfollowOrCancel],
])('POST /api/users/[username]/%s before any write', (_name, route, writer) => {
  it('rejects a malformed username', async () => {
    const response = await post(route, 'no spaces allowed');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'request.invalidUsername' });
    expect(writer).not.toHaveBeenCalled();
  });

  it('asks for a session', async () => {
    const response = await post(route, 'chef', { signedIn: false });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'unauthorized' });
    expect(writer).not.toHaveBeenCalled();
  });

  it('rejects a session that is no longer valid', async () => {
    (verifySessionToken as jest.Mock).mockResolvedValue(null);

    const response = await post(route);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid token', code: 'auth.invalidToken' });
    expect(writer).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that does not exist', async () => {
    mockGetUserByUsername.mockResolvedValue(null);

    const response = await post(route);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
    expect(writer).not.toHaveBeenCalled();
  });
});
