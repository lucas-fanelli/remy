/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * The owner's side of following a private account: GET /api/follow-requests (the inbox),
 * and POST /api/follow-requests/[username]/accept and /decline.
 *
 * The writes are src/lib/follows/requests.ts', tested there. These tests pin the routes'
 * half: who the owner is (always the session, never the path), what "nothing to act on"
 * answers, and that the inbox is read from "follow_requests" with the requester's header
 * only.
 */

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    follow: { count: jest.fn() },
    followRequest: { findMany: jest.fn(), count: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

const mockGetUserByUsername = jest.fn();
jest.mock('@/lib/container/container', () => ({
  container: { getUserService: () => ({ getUserByUsername: mockGetUserByUsername }) },
}));

jest.mock('@/lib/follows/requests', () => ({
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
}));

jest.mock('@/lib/follows/state', () => ({ followStateOf: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { acceptRequest, declineRequest } from '@/lib/follows/requests';
import { followStateOf } from '@/lib/follows/state';
import { POST as acceptPOST } from '../follow-requests/[username]/accept/route';
import { POST as declinePOST } from '../follow-requests/[username]/decline/route';
import { GET as listGET } from '../follow-requests/route';

const OWNER_ID = 'owner-1';
const REQUESTER = { id: 'requester-1', username: 'fan' };

function signedIn() {
  (requireAuth as jest.Mock).mockResolvedValue({ id: OWNER_ID, username: 'chef' });
}

function signedOut() {
  (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));
}

function list(query = ''): Promise<Response> {
  return listGET(new NextRequest(`http://localhost:3000/api/follow-requests${query}`));
}

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) => Promise<Response>;

function act(route: Handler, username = REQUESTER.username): Promise<Response> {
  const request = new NextRequest(`http://localhost:3000/api/follow-requests/${username}/x`, {
    method: 'POST',
  });
  return route(request, { params: Promise.resolve({ username }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  signedIn();
  mockGetUserByUsername.mockResolvedValue(REQUESTER);
  (prisma.follow.count as jest.Mock).mockResolvedValue(12);
  (prisma.followRequest.count as jest.Mock).mockResolvedValue(3);
  (prisma.followRequest.findMany as jest.Mock).mockResolvedValue([]);
  (followStateOf as jest.Mock).mockResolvedValue('none');
});

describe('GET /api/follow-requests', () => {
  const ROW = {
    createdAt: new Date('2026-09-20T10:00:00Z'),
    requester: { id: REQUESTER.id, username: 'fan', fullName: 'A Fan', avatar: null },
  };

  it("lists the owner's pending requests newest first, with the requester's header only", async () => {
    (prisma.followRequest.findMany as jest.Mock).mockResolvedValue([ROW]);

    const response = await list();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requests: [
        {
          createdAt: '2026-09-20T10:00:00.000Z',
          requester: { id: REQUESTER.id, username: 'fan', fullName: 'A Fan', avatar: null },
        },
      ],
      total: 3,
    });
    expect(prisma.followRequest.findMany).toHaveBeenCalledWith({
      where: { targetId: OWNER_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
      // A locked profile's fields and no more: no email, role, website or bio
      select: {
        createdAt: true,
        requester: { select: { id: true, username: true, fullName: true, avatar: true } },
      },
    });
    // The total counts the same rows the pages walk through
    expect(prisma.followRequest.count).toHaveBeenCalledWith({ where: { targetId: OWNER_ID } });
  });

  it.each([
    ['?limit=5&offset=10', 5, 10],
    ['?limit=500', 100, 0],
    ['?limit=-3&offset=-4', 1, 0],
    ['?limit=abc&offset=xyz', 20, 0],
  ])('pages with %s as take %i, skip %i', async (query, take, skip) => {
    await list(query);

    expect(prisma.followRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take, skip })
    );
  });

  it('asks for a session, and reads nothing without one', async () => {
    signedOut();

    const response = await list();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'unauthorized' });
    expect(prisma.followRequest.findMany).not.toHaveBeenCalled();
  });

  it('answers 500 followRequest.listFailed when the read fails', async () => {
    (prisma.followRequest.findMany as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await list();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch follow requests',
      code: 'followRequest.listFailed',
    });
  });
});

describe('POST /api/follow-requests/[username]/accept', () => {
  it('accepts, as the signed-in owner, and answers with both of their counts', async () => {
    (acceptRequest as jest.Mock).mockResolvedValue({ accepted: true });

    const response = await act(acceptPOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      result: 'accepted',
      followersCount: 12,
      pendingCount: 3,
    });
    // The owner is the session; the path names the requester
    expect(acceptRequest).toHaveBeenCalledWith(prisma, OWNER_ID, REQUESTER.id);
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followingId: OWNER_ID } });
    expect(prisma.followRequest.count).toHaveBeenCalledWith({ where: { targetId: OWNER_ID } });
    expect(followStateOf).not.toHaveBeenCalled();
  });

  it('answers a repeat, or a request that going public accepted, with alreadyFollowing', async () => {
    (acceptRequest as jest.Mock).mockResolvedValue({ accepted: false });
    (followStateOf as jest.Mock).mockResolvedValue('following');

    const response = await act(acceptPOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      result: 'alreadyFollowing',
      followersCount: 12,
      pendingCount: 3,
    });
    // Asked from the requester's side: do THEY follow the owner?
    expect(followStateOf).toHaveBeenCalledWith(prisma, REQUESTER.id, OWNER_ID);
  });

  it('answers 404 followRequest.notFound when the request was cancelled, declined or never sent', async () => {
    (acceptRequest as jest.Mock).mockResolvedValue({ accepted: false });
    (followStateOf as jest.Mock).mockResolvedValue('none');

    const response = await act(acceptPOST);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Follow request not found',
      code: 'followRequest.notFound',
    });
  });

  it('answers 500 followRequest.acceptFailed when the write fails', async () => {
    (acceptRequest as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await act(acceptPOST);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to accept follow request',
      code: 'followRequest.acceptFailed',
    });
  });
});

describe('POST /api/follow-requests/[username]/decline', () => {
  it('declines, as the signed-in owner, and answers with the pending count', async () => {
    (declineRequest as jest.Mock).mockResolvedValue({ declined: true });

    const response = await act(declinePOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, declined: true, pendingCount: 3 });
    expect(declineRequest).toHaveBeenCalledWith(prisma, OWNER_ID, REQUESTER.id);
    expect(prisma.followRequest.count).toHaveBeenCalledWith({ where: { targetId: OWNER_ID } });
  });

  it('succeeds with declined: false when nothing is pending and they do not follow', async () => {
    // A repeat, or the requester took it back first: the end state is what declining wanted
    (declineRequest as jest.Mock).mockResolvedValue({ declined: false });
    (followStateOf as jest.Mock).mockResolvedValue('none');

    const response = await act(declinePOST);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, declined: false, pendingCount: 3 });
    expect(followStateOf).toHaveBeenCalledWith(prisma, REQUESTER.id, OWNER_ID);
  });

  it('answers 404 when the request already became a follow, rather than claim a decline', async () => {
    (declineRequest as jest.Mock).mockResolvedValue({ declined: false });
    (followStateOf as jest.Mock).mockResolvedValue('following');

    const response = await act(declinePOST);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Follow request not found',
      code: 'followRequest.notFound',
    });
  });

  it('answers 500 followRequest.declineFailed when the write fails', async () => {
    (declineRequest as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const response = await act(declinePOST);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to decline follow request',
      code: 'followRequest.declineFailed',
    });
  });
});

describe.each([
  ['accept', acceptPOST, acceptRequest],
  ['decline', declinePOST, declineRequest],
])('POST /api/follow-requests/[username]/%s before any write', (_name, route, writer) => {
  it('rejects a malformed username', async () => {
    const response = await act(route, '../../etc');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'request.invalidUsername' });
    expect(writer).not.toHaveBeenCalled();
  });

  it('asks for a session', async () => {
    signedOut();

    const response = await act(route);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'unauthorized' });
    expect(writer).not.toHaveBeenCalled();
  });

  it('answers 404 user.notFound for a requester that does not exist', async () => {
    mockGetUserByUsername.mockResolvedValue(null);

    const response = await act(route);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
    expect(writer).not.toHaveBeenCalled();
  });
});
