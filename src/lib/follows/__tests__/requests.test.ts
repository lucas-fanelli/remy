/**
 * @jest-environment node
 */
import { Prisma } from '@prisma/client';
import * as constants from '@/lib/constants';
import { logServerError } from '@/lib/utils/logger';
import {
  acceptAllPending,
  acceptRequest,
  declineRequest,
  FOLLOW_OWNER_LOCK,
  FOLLOW_PAIR_LOCK,
  FollowError,
  followOrRequest,
  notifyRequestsAccepted,
  removeFollower,
  unfollowOrCancel,
} from '../requests';

jest.mock('@/lib/database/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/utils/logger', () => ({ logServerError: jest.fn() }));
jest.mock('@/infrastructure/services/NotificationService', () => {
  const service = {
    createFollowNotification: jest.fn(),
    deleteFollowNotification: jest.fn(),
    createFollowRequestNotification: jest.fn(),
    deleteFollowRequestNotification: jest.fn(),
    createFollowAcceptedNotification: jest.fn(),
  };
  return { NotificationService: jest.fn(() => service), service };
});

const notifications: Record<string, jest.Mock> = jest.requireMock(
  '@/infrastructure/services/NotificationService'
).service;

const ME = 'requester-1';
const OWNER = 'owner-1';

/**
 * `prisma` with its transaction run inline. `committed` is called when the callback has
 * returned — the moment the real transaction commits — so a test can tell what ran inside
 * it from what ran after.
 */
function mockDb() {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn().mockResolvedValue({ isPrivate: true }) },
    follow: {
      findUnique: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    followRequest: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const committed = jest.fn();
  const db = {
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => {
      const result = await work(tx);
      committed();
      return result;
    }),
  };
  return { db, tx, committed };
}

type MockTx = ReturnType<typeof mockDb>['tx'];

/** The SQL of a tagged-template call, parameters as `?`, and the parameters. */
function rawCall(fn: jest.Mock, index: number): { sql: string; values: unknown[] } {
  const [strings, ...values] = fn.mock.calls[index] as [TemplateStringsArray, ...unknown[]];
  return { sql: strings.join('?').replace(/\s+/g, ' ').trim(), values };
}

const firstCall = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];

/** Every table call the writer made, besides the locks. */
function tableCalls(tx: MockTx): jest.Mock[] {
  return [
    tx.$queryRaw,
    tx.user.findUnique,
    ...Object.values(tx.follow),
    ...Object.values(tx.followRequest),
  ].filter((fn) => fn.mock.calls.length > 0);
}

/**
 * The pair writers' opening: the followed account's owner lock, shared, then the pair's
 * lock — both before anything is read or written.
 */
function expectPairLockedFirst(tx: MockTx, followerId: string, followedId: string) {
  expect(tx.$executeRaw).toHaveBeenCalledTimes(2);

  const owner = rawCall(tx.$executeRaw, 0);
  expect(owner.sql).toBe('SELECT pg_advisory_xact_lock_shared(?::int, hashtext(?))');
  expect(owner.values).toEqual([FOLLOW_OWNER_LOCK, followedId]);

  const pair = rawCall(tx.$executeRaw, 1);
  expect(pair.sql).toBe('SELECT pg_advisory_xact_lock(?::int, hashtext(?))');
  expect(pair.values).toEqual([FOLLOW_PAIR_LOCK, `${followerId}:${followedId}`]);

  const lastLock = tx.$executeRaw.mock.invocationCallOrder[1];
  const calls = tableCalls(tx);
  expect(calls.length).toBeGreaterThan(0);
  for (const fn of calls) expect(firstCall(fn)).toBeGreaterThan(lastLock);
}

/** Every notification written, and none before the commit. */
function expectNotifiedAfter(committed: jest.Mock) {
  for (const fn of Object.values(notifications)) {
    for (const order of fn.mock.invocationCallOrder) {
      expect(order).toBeGreaterThan(firstCall(committed));
    }
  }
}

/** Every notification call as [method, ...args], in the order they were made. */
const notified = () =>
  Object.entries(notifications)
    .flatMap(([name, fn]) =>
      fn.mock.calls.map((args, i) => ({
        order: fn.mock.invocationCallOrder[i],
        call: [name, ...args],
      }))
    )
    .sort((a, b) => a.order - b.order)
    .map(({ call }) => call);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('followOrRequest', () => {
  it('refuses to follow yourself before opening a transaction', async () => {
    const { db } = mockDb();

    const attempt = followOrRequest(db as never, ME, { id: ME, isPrivate: false });

    await expect(attempt).rejects.toBeInstanceOf(FollowError);
    await expect(attempt).rejects.toMatchObject({ code: 'user.cannotFollowSelf' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  describe('a public account', () => {
    it('follows at once, and says so to the owner after the commit', async () => {
      const { db, tx, committed } = mockDb();

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

      expect(result).toEqual({ state: 'following', created: true });
      expectPairLockedFirst(tx, ME, OWNER);
      expect(tx.follow.createMany).toHaveBeenCalledWith({
        data: [{ followerId: ME, followingId: OWNER }],
        skipDuplicates: true,
      });
      expect(tx.followRequest.createMany).not.toHaveBeenCalled();
      expect(notified()).toEqual([['createFollowNotification', ME, OWNER]]);
      expectNotifiedAfter(committed);
    });

    it("trusts the caller's 'public' without reading the account again", async () => {
      // A stale 'public' makes a follow a moment after the account went private — what
      // someone who tapped a moment earlier already is, and stays.
      const { db, tx } = mockDb();

      await followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

      expect(tx.user.findUnique).not.toHaveBeenCalled();
    });

    it('deletes a request left over from when it was private, and its notification', async () => {
      const { db, tx } = mockDb();
      tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });

      await followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

      expect(tx.followRequest.deleteMany).toHaveBeenCalledWith({
        where: { requesterId: ME, targetId: OWNER },
      });
      expect(notified()).toContainEqual(['deleteFollowRequestNotification', ME, OWNER]);
    });

    it('writes and notifies nothing new on a repeat', async () => {
      const { db, tx } = mockDb();
      tx.follow.createMany.mockResolvedValue({ count: 0 });

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

      expect(result).toEqual({ state: 'following', created: false });
      expect(notified()).toEqual([]);
    });
  });

  describe('a private account', () => {
    it('asks: one request, and one doorbell for the owner after the commit', async () => {
      const { db, tx, committed } = mockDb();

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: true });

      expect(result).toEqual({ state: 'requested', created: true });
      expectPairLockedFirst(tx, ME, OWNER);
      expect(tx.followRequest.createMany).toHaveBeenCalledWith({
        data: [{ requesterId: ME, targetId: OWNER }],
        skipDuplicates: true,
      });
      expect(tx.follow.createMany).not.toHaveBeenCalled();
      expect(notified()).toEqual([['createFollowRequestNotification', ME, OWNER]]);
      expectNotifiedAfter(committed);
    });

    it('rings no second doorbell on a repeat', async () => {
      const { db, tx } = mockDb();
      tx.followRequest.createMany.mockResolvedValue({ count: 0 });

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: true });

      expect(result).toEqual({ state: 'requested', created: false });
      expect(notified()).toEqual([]);
    });

    it('leaves an existing follower following, with no request', async () => {
      // People who followed before the account went private stay followers.
      const { db, tx } = mockDb();
      tx.follow.findUnique.mockResolvedValue({ id: 'follow-1' });

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: true });

      expect(result).toEqual({ state: 'following', created: false });
      expect(tx.follow.findUnique).toHaveBeenCalledWith({
        where: { followerId_followingId: { followerId: ME, followingId: OWNER } },
        select: { id: true },
      });
      expect(tx.followRequest.createMany).not.toHaveBeenCalled();
      expect(notified()).toEqual([]);
    });

    it('follows instead when the account went public before the owner lock was ours', async () => {
      // Its sweep has already run: a request made now would wait forever on a public
      // account. The account is read again under the lock, which the sweep holds while it
      // runs.
      const { db, tx } = mockDb();
      tx.user.findUnique.mockResolvedValue({ isPrivate: false });

      const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: true });

      expect(result).toEqual({ state: 'following', created: true });
      expect(tx.user.findUnique).toHaveBeenCalledWith({
        where: { id: OWNER },
        select: { isPrivate: true },
      });
      expect(firstCall(tx.user.findUnique)).toBeGreaterThan(
        tx.$executeRaw.mock.invocationCallOrder[1]
      );
      expect(tx.followRequest.createMany).not.toHaveBeenCalled();
      expect(tx.follow.createMany).toHaveBeenCalled();
    });

    it('answers user.notFound, writing nothing, when the account is gone', async () => {
      const { db, tx } = mockDb();
      tx.user.findUnique.mockResolvedValue(null);

      const attempt = followOrRequest(db as never, ME, { id: OWNER, isPrivate: true });

      await expect(attempt).rejects.toMatchObject({ code: 'user.notFound' });
      expect(tx.followRequest.createMany).not.toHaveBeenCalled();
      expect(tx.follow.createMany).not.toHaveBeenCalled();
      expect(notified()).toEqual([]);
    });
  });

  it('answers user.notFound when an account was deleted mid-insert (foreign key)', async () => {
    const { db, tx } = mockDb();
    tx.follow.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      })
    );

    const attempt = followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

    await expect(attempt).rejects.toBeInstanceOf(FollowError);
    await expect(attempt).rejects.toMatchObject({ code: 'user.notFound' });
  });

  it('passes any other failure through, and notifies nobody', async () => {
    const { db, tx } = mockDb();
    const failure = new Error('connection reset');
    tx.follow.createMany.mockRejectedValue(failure);

    await expect(followOrRequest(db as never, ME, { id: OWNER, isPrivate: false })).rejects.toBe(
      failure
    );
    expect(notified()).toEqual([]);
  });

  it('still reports the follow when its notification fails to save', async () => {
    const { db } = mockDb();
    notifications.createFollowNotification.mockRejectedValueOnce(new Error('db down'));

    const result = await followOrRequest(db as never, ME, { id: OWNER, isPrivate: false });

    expect(result).toEqual({ state: 'following', created: true });
    expect(logServerError).toHaveBeenCalledWith(
      'Failed to create the follow notification:',
      expect.any(Error)
    );
  });
});

describe('unfollowOrCancel', () => {
  it('deletes the request BEFORE the follow, both under the pair lock', async () => {
    // Follows first, a cancel racing an accept would find no follow yet, then no request,
    // and answer 'none' over the follow the accept had just made.
    const { db, tx } = mockDb();

    await unfollowOrCancel(db as never, ME, OWNER);

    expectPairLockedFirst(tx, ME, OWNER);
    expect(tx.followRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: ME, targetId: OWNER },
    });
    expect(tx.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: ME, followingId: OWNER },
    });
    expect(firstCall(tx.followRequest.deleteMany)).toBeLessThan(firstCall(tx.follow.deleteMany));
  });

  it('unfollows: was following, and the follow notification goes after the commit', async () => {
    const { db, tx, committed } = mockDb();
    tx.follow.deleteMany.mockResolvedValue({ count: 1 });

    await expect(unfollowOrCancel(db as never, ME, OWNER)).resolves.toEqual({ was: 'following' });
    expect(notified()).toEqual([['deleteFollowNotification', ME, OWNER]]);
    expectNotifiedAfter(committed);
  });

  it("cancels: was requested, and the owner's doorbell goes", async () => {
    const { db, tx } = mockDb();
    tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });

    await expect(unfollowOrCancel(db as never, ME, OWNER)).resolves.toEqual({ was: 'requested' });
    expect(notified()).toEqual([['deleteFollowRequestNotification', ME, OWNER]]);
  });

  it('succeeds with was none when there was nothing to undo', async () => {
    const { db } = mockDb();

    await expect(unfollowOrCancel(db as never, ME, OWNER)).resolves.toEqual({ was: 'none' });
    expect(notified()).toEqual([]);
  });

  it('reports the follow when a broken pair was in both tables, and clears both', async () => {
    const { db, tx } = mockDb();
    tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });
    tx.follow.deleteMany.mockResolvedValue({ count: 1 });

    await expect(unfollowOrCancel(db as never, ME, OWNER)).resolves.toEqual({ was: 'following' });
    expect(notified()).toEqual([
      ['deleteFollowRequestNotification', ME, OWNER],
      ['deleteFollowNotification', ME, OWNER],
    ]);
  });
});

describe('acceptRequest', () => {
  it('claims the request, then follows, and tells the requester after the commit', async () => {
    const { db, tx, committed } = mockDb();
    tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });

    await expect(acceptRequest(db as never, OWNER, ME)).resolves.toEqual({ accepted: true });

    expectPairLockedFirst(tx, ME, OWNER);
    expect(tx.followRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: ME, targetId: OWNER },
    });
    expect(tx.follow.createMany).toHaveBeenCalledWith({
      data: [{ followerId: ME, followingId: OWNER }],
      skipDuplicates: true,
    });
    expect(firstCall(tx.followRequest.deleteMany)).toBeLessThan(firstCall(tx.follow.createMany));
    expect(notified()).toEqual([
      ['deleteFollowRequestNotification', ME, OWNER],
      ['createFollowAcceptedNotification', OWNER, ME],
    ]);
    expectNotifiedAfter(committed);
  });

  it('follows nobody and tells nobody when nothing was pending', async () => {
    // Cancelled, declined, or accepted by an earlier tap: a request is accepted once.
    const { db, tx } = mockDb();

    await expect(acceptRequest(db as never, OWNER, ME)).resolves.toEqual({ accepted: false });
    expect(tx.follow.createMany).not.toHaveBeenCalled();
    expect(notified()).toEqual([]);
  });
});

describe('declineRequest', () => {
  it("deletes the request and the owner's doorbell, and tells the requester nothing", async () => {
    const { db, tx, committed } = mockDb();
    tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });

    await expect(declineRequest(db as never, OWNER, ME)).resolves.toEqual({ declined: true });

    expectPairLockedFirst(tx, ME, OWNER);
    expect(tx.followRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: ME, targetId: OWNER },
    });
    expect(notified()).toEqual([['deleteFollowRequestNotification', ME, OWNER]]);
    expectNotifiedAfter(committed);
  });

  it('never removes someone who already follows', async () => {
    const { db, tx } = mockDb();

    await expect(declineRequest(db as never, OWNER, ME)).resolves.toEqual({ declined: false });
    expect(tx.follow.deleteMany).not.toHaveBeenCalled();
    expect(notified()).toEqual([]);
  });
});

describe('removeFollower', () => {
  it('removes the follower, pending request first, and tells them nothing', async () => {
    const { db, tx, committed } = mockDb();
    tx.follow.deleteMany.mockResolvedValue({ count: 1 });

    await expect(removeFollower(db as never, OWNER, ME)).resolves.toEqual({ removed: true });

    expectPairLockedFirst(tx, ME, OWNER);
    expect(tx.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: ME, followingId: OWNER },
    });
    expect(firstCall(tx.followRequest.deleteMany)).toBeLessThan(firstCall(tx.follow.deleteMany));
    expect(notified()).toEqual([['deleteFollowNotification', ME, OWNER]]);
    expectNotifiedAfter(committed);
  });

  it('also deletes a pending request, so nothing of theirs is left waiting', async () => {
    const { db, tx } = mockDb();
    tx.followRequest.deleteMany.mockResolvedValue({ count: 1 });

    await expect(removeFollower(db as never, OWNER, ME)).resolves.toEqual({ removed: false });
    expect(tx.followRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: ME, targetId: OWNER },
    });
    expect(notified()).toEqual([['deleteFollowRequestNotification', ME, OWNER]]);
  });
});

describe('acceptAllPending (the private → public sweep)', () => {
  it('takes the owner lock EXCLUSIVELY, then claims and follows exactly what it claimed', async () => {
    const { tx } = mockDb();
    tx.$queryRaw.mockResolvedValue([{ requesterId: 'a' }, { requesterId: 'b' }]);

    await expect(acceptAllPending(tx as never, OWNER)).resolves.toEqual({ accepted: ['a', 'b'] });

    // Exclusive where the pair writers share it: they wait for the sweep, not for each other.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const lock = rawCall(tx.$executeRaw, 0);
    expect(lock.sql).toBe('SELECT pg_advisory_xact_lock(?::int, hashtext(?))');
    expect(lock.values).toEqual([FOLLOW_OWNER_LOCK, OWNER]);

    const claim = rawCall(tx.$queryRaw, 0);
    expect(claim.sql).toBe(
      'DELETE FROM "follow_requests" WHERE "targetId" = ? RETURNING "requesterId"'
    );
    expect(claim.values).toEqual([OWNER]);
    expect(firstCall(tx.$queryRaw)).toBeGreaterThan(firstCall(tx.$executeRaw));

    expect(tx.follow.createMany).toHaveBeenCalledWith({
      data: [
        { followerId: 'a', followingId: OWNER },
        { followerId: 'b', followingId: OWNER },
      ],
      skipDuplicates: true,
    });
    expect(firstCall(tx.follow.createMany)).toBeGreaterThan(firstCall(tx.$queryRaw));

    // The claim is the only thing that touched the requests: no list read before it, whose
    // rows could be cancelled before a later delete and still become follows.
    expect(tx.followRequest.deleteMany).not.toHaveBeenCalled();
  });

  it('follows nobody when nothing was pending', async () => {
    const { tx } = mockDb();

    await expect(acceptAllPending(tx as never, OWNER)).resolves.toEqual({ accepted: [] });
    expect(tx.follow.createMany).not.toHaveBeenCalled();
  });

  it("sends nothing itself: it cannot know when the caller's transaction commits", async () => {
    const { tx } = mockDb();
    tx.$queryRaw.mockResolvedValue([{ requesterId: 'a' }]);

    await acceptAllPending(tx as never, OWNER);

    expect(notified()).toEqual([]);
  });
});

describe('notifyRequestsAccepted', () => {
  it("tells each requester, and takes each request's doorbell away", async () => {
    await notifyRequestsAccepted(OWNER, ['a', 'b']);

    expect(notified()).toEqual([
      ['deleteFollowRequestNotification', 'a', OWNER],
      ['createFollowAcceptedNotification', OWNER, 'a'],
      ['deleteFollowRequestNotification', 'b', OWNER],
      ['createFollowAcceptedNotification', OWNER, 'b'],
    ]);
  });

  it('carries on past a notification that fails, and never throws', async () => {
    notifications.createFollowAcceptedNotification.mockRejectedValueOnce(new Error('db down'));

    await expect(notifyRequestsAccepted(OWNER, ['a', 'b'])).resolves.toBeUndefined();

    expect(notifications.createFollowAcceptedNotification).toHaveBeenCalledWith(OWNER, 'b');
    expect(logServerError).toHaveBeenCalledTimes(1);
  });
});

describe('the lock namespaces', () => {
  it('are two, and taken by no other feature', () => {
    // src/lib/constants.ts allocates every other advisory-lock namespace; a shared number
    // would make unrelated work wait on follows, or worse, let it through.
    const taken = Object.entries(constants)
      .filter(([name]) => name.startsWith('PG_ADVISORY_LOCK_'))
      .map(([, value]) => value);

    expect(taken.length).toBeGreaterThan(5);
    expect(FOLLOW_OWNER_LOCK).not.toBe(FOLLOW_PAIR_LOCK);
    expect(taken).not.toContain(FOLLOW_OWNER_LOCK);
    expect(taken).not.toContain(FOLLOW_PAIR_LOCK);
  });

  it('fit an int4, the only type the two-key form takes', () => {
    for (const key of [FOLLOW_OWNER_LOCK, FOLLOW_PAIR_LOCK]) {
      expect(Number.isInteger(key)).toBe(true);
      expect(Math.abs(key)).toBeLessThan(2 ** 31);
    }
  });
});
