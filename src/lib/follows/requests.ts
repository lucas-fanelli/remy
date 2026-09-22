import { Prisma, type PrismaClient } from '@prisma/client';
import { NotificationRepository } from '@/infrastructure/repositories/NotificationRepository';
import { NotificationService } from '@/infrastructure/services/NotificationService';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';
import type { INotificationService } from '@/domain/services/INotificationService';
import type { FollowState } from '@/domain/types/follow';

/**
 * The only code that writes "follows" and "follow_requests" — guard.test.ts fails on any
 * other writer.
 *
 * Following a public account is immediate. Following a private one asks first: the request
 * waits in "follow_requests" until the owner accepts it, and only then becomes a row in
 * "follows", the one table that opens a private account's recipes
 * (src/lib/privacy/visibility.ts). Anyone who already follows an account when it goes
 * private stays a follower; the owner can remove them (removeFollower).
 *
 * THE INVARIANT: a pair (follower, followed) is in at most one of the two tables. It spans
 * two tables, so the database cannot hold it; these writers do, and nothing else may write
 * either table. A slip fails closed — the stray row is a request, and a request grants
 * nothing.
 *
 * LOCKS. Every writer of a pair opens its transaction by taking two advisory locks, always
 * in this order:
 *   1. the followed account's OWNER lock, shared;
 *   2. the PAIR lock, exclusive.
 * The pair lock makes everything that can happen to one pair take turns — a tap on
 * "Solicitado" racing the owner's "Aceptar", a double tap, a decline racing a new request —
 * so each writer reads and writes as if it ran alone. Without it the two tables race: a
 * request inserted while an accept deletes the old one waits on that row, goes in once the
 * accept commits, and the pair is left in both tables with a second doorbell for someone
 * who already follows.
 * The owner lock is for the private → public sweep (acceptAllPending), which takes it
 * EXCLUSIVELY: it waits for every pair writer on that account to finish and holds the next
 * ones off until the account is public and every request it claimed is a follow. Pair
 * writers only share it, so follows of one popular account queue behind the sweep, never
 * behind each other. Both locks are transaction-scoped: released at commit or rollback.
 *
 * TRANSACTIONS. The pair writers take `prisma` and open their own: each is a whole unit of
 * work, and its notifications must wait for its commit. acceptAllPending runs in the
 * caller's instead, because it belongs to the profile update that makes the account public
 * and must commit or roll back with it; that caller sends its notifications after the
 * commit, with notifyRequestsAccepted.
 *
 * NOTIFICATIONS are written after the commit and best-effort, as the follow route always
 * did: a notification that fails to save must not undo a follow that happened, nor report
 * it as failed. The tables are the truth — the owner's inbox reads "follow_requests" — and
 * a notification is only the doorbell.
 *
 * Inserts go through createMany with skipDuplicates (INSERT ... ON CONFLICT DO NOTHING) and
 * read its count, never create plus a P2002 catch: inside an interactive transaction a
 * unique violation aborts the whole PostgreSQL transaction, and there is nothing left to
 * carry on in.
 */

/**
 * Advisory-lock namespaces, the first of the two keys. They follow the ones allocated in
 * src/lib/constants.ts (48879-48885), and requests.test.ts fails if one of those ever takes
 * the same number. The second key is hashtext() of an id, an int4 like the first: the
 * two-key form exists only as (int4, int4), and Prisma binds a JS number as bigint — hence
 * the ::int on every first key.
 */
export const FOLLOW_OWNER_LOCK = 48886;
export const FOLLOW_PAIR_LOCK = 48887;

/** What the pair writers need: a client that can open an interactive transaction — `prisma`. */
export type FollowsDb = Pick<PrismaClient, '$transaction'>;

/** What the sweep needs from the transaction it runs in. */
export type SweepTx = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw' | 'follow'>;

/** The account to follow, as the caller read it. */
export interface FollowTarget {
  id: string;
  isPrivate: boolean;
}

export interface FollowOrRequestResult {
  /** 'requested' only while the account is private; see FollowState. */
  state: Exclude<FollowState, 'none'>;
  /** False when the row was already there: a repeat tap, which writes and notifies nothing. */
  created: boolean;
}

/**
 * A follow this module refuses. `code` is the API error code to answer with — both are in
 * errorCodes.ts already: 400 for yourself, 404 for an account that is gone.
 */
export class FollowError extends Error {
  readonly code: 'user.cannotFollowSelf' | 'user.notFound';

  constructor(code: FollowError['code'], message: string) {
    super(message);
    this.name = 'FollowError';
    this.code = code;
    // Keeps `instanceof` working if the class is ever compiled down to ES5
    Object.setPrototypeOf(this, FollowError.prototype);
  }
}

/**
 * Tap "Seguir".
 *
 * A public account: the follow is made at once, and a request left over from when the
 * account was private is deleted with it. A private account: a request is made, unless
 * the requester already follows — from before the account went private, or accepted since —
 * which stays as it is. Repeats are harmless: same answer, `created: false`, no second row
 * and no second notification.
 *
 * Throws FollowError('user.cannotFollowSelf') for yourself, and FollowError('user.notFound')
 * when either account was deleted after the caller read it.
 */
export async function followOrRequest(
  db: FollowsDb,
  requesterId: string,
  target: FollowTarget
): Promise<FollowOrRequestResult> {
  if (requesterId === target.id) {
    throw new FollowError('user.cannotFollowSelf', 'Cannot follow yourself');
  }

  const outcome = await db
    .$transaction(async (tx): Promise<FollowOrRequestResult & { clearedRequest: boolean }> => {
      await lockPair(tx, requesterId, target.id);
      const pair = { followerId: requesterId, followingId: target.id };

      // The caller's "private" is read again, now that the owner lock is held. A stale
      // "private" is the one that strands a request: if the account went public since, its
      // sweep has already run, and a request made now would wait on a public account for
      // an accept nobody is asked for. Under the owner lock this read comes after any sweep
      // has committed, and sees the account public. A stale "public" needs no second look:
      // it makes a follow a moment after the account went private, which is what everyone
      // who followed a moment before already is, and they stay.
      const isPrivate = target.isPrivate ? await isPrivateNow(tx, target.id) : false;

      if (!isPrivate) {
        const follow = await tx.follow.createMany({ data: [pair], skipDuplicates: true });
        const stale = await tx.followRequest.deleteMany({
          where: { requesterId, targetId: target.id },
        });
        return { state: 'following', created: follow.count === 1, clearedRequest: stale.count > 0 };
      }

      const follows = await tx.follow.findUnique({
        where: { followerId_followingId: pair },
        select: { id: true },
      });
      if (follows) return { state: 'following', created: false, clearedRequest: false };

      const request = await tx.followRequest.createMany({
        data: [{ requesterId, targetId: target.id }],
        skipDuplicates: true,
      });
      return { state: 'requested', created: request.count === 1, clearedRequest: false };
    })
    .catch(rethrowGoneAccount);

  if (outcome.created && outcome.state === 'requested') {
    await bestEffort('create the follow request notification', (notifications) =>
      notifications.createFollowRequestNotification(requesterId, target.id)
    );
  }
  if (outcome.created && outcome.state === 'following') {
    await bestEffort('create the follow notification', (notifications) =>
      notifications.createFollowNotification(requesterId, target.id)
    );
  }
  if (outcome.clearedRequest) {
    await bestEffort('delete the follow request notification', (notifications) =>
      notifications.deleteFollowRequestNotification(requesterId, target.id)
    );
  }

  return { state: outcome.state, created: outcome.created };
}

/**
 * Tap "Siguiendo" or "Solicitado": stop following, or take the request back — whichever
 * there is. `was` says which, so the client can tell an unfollow from a cancel; 'none'
 * means there was nothing to undo, which is still the state asked for.
 */
export async function unfollowOrCancel(
  db: FollowsDb,
  viewerId: string,
  targetId: string
): Promise<{ was: FollowState }> {
  const removed = await db.$transaction(async (tx) => {
    await lockPair(tx, viewerId, targetId);
    return removeBoth(tx, viewerId, targetId);
  });

  if (removed.request) {
    await bestEffort('delete the follow request notification', (notifications) =>
      notifications.deleteFollowRequestNotification(viewerId, targetId)
    );
  }
  if (removed.follow) {
    await bestEffort('delete the follow notification', (notifications) =>
      notifications.deleteFollowNotification(viewerId, targetId)
    );
  }

  // Both at once would be a broken invariant; the follow is the one that granted access.
  if (removed.follow) return { was: 'following' };
  return { was: removed.request ? 'requested' : 'none' };
}

/**
 * The owner taps "Aceptar". `accepted: false` means nothing was pending — cancelled,
 * declined, already accepted by an earlier tap or by going public — and nothing is written.
 * The route tells "already a follower" from "gone" with followStateOf.
 */
export async function acceptRequest(
  db: FollowsDb,
  ownerId: string,
  requesterId: string
): Promise<{ accepted: boolean }> {
  const accepted = await db.$transaction(async (tx) => {
    await lockPair(tx, requesterId, ownerId);
    // Claim the request by deleting it, and follow only if this delete is the one that got
    // it: a request can be accepted once.
    const claimed = await tx.followRequest.deleteMany({
      where: { requesterId, targetId: ownerId },
    });
    if (claimed.count === 0) return false;

    await tx.follow.createMany({
      data: [{ followerId: requesterId, followingId: ownerId }],
      skipDuplicates: true,
    });
    return true;
  });

  if (accepted) await announceAccepted(ownerId, requesterId);
  return { accepted };
}

/**
 * The owner taps "Rechazar". The requester is not told, and may ask again. Only a pending
 * request is touched: declining never removes someone who already follows.
 */
export async function declineRequest(
  db: FollowsDb,
  ownerId: string,
  requesterId: string
): Promise<{ declined: boolean }> {
  const declined = await db.$transaction(async (tx) => {
    await lockPair(tx, requesterId, ownerId);
    const request = await tx.followRequest.deleteMany({
      where: { requesterId, targetId: ownerId },
    });
    return request.count > 0;
  });

  if (declined) {
    await bestEffort('delete the follow request notification', (notifications) =>
      notifications.deleteFollowRequestNotification(requesterId, ownerId)
    );
  }
  return { declined };
}

/**
 * The owner removes a follower — how an account that went private closes itself to people
 * who followed it while it was public. A pending request from them goes too, so removing
 * someone leaves nothing of theirs waiting. They are not told.
 */
export async function removeFollower(
  db: FollowsDb,
  ownerId: string,
  followerId: string
): Promise<{ removed: boolean }> {
  const removed = await db.$transaction(async (tx) => {
    await lockPair(tx, followerId, ownerId);
    return removeBoth(tx, followerId, ownerId);
  });

  if (removed.request) {
    await bestEffort('delete the follow request notification', (notifications) =>
      notifications.deleteFollowRequestNotification(followerId, ownerId)
    );
  }
  if (removed.follow) {
    await bestEffort('delete the follow notification', (notifications) =>
      notifications.deleteFollowNotification(followerId, ownerId)
    );
  }
  return { removed: removed.follow };
}

/**
 * The private → public sweep: every pending request to `ownerId` becomes a follow, because a
 * public account has nothing left to approve. Returns who was accepted.
 *
 * Call it inside the transaction whose update makes the account public, so the two commit
 * or roll back together — and before that update. Either order keeps every request: the
 * owner lock is held until commit, and a follow that waited for it reads the account again
 * once it has it. But an update that also changes the username holds the users row in the
 * mode a follow's foreign-key check waits on; made first, this transaction would then wait
 * for the owner lock while the follow holding it waits for the row — a deadlock PostgreSQL
 * breaks by failing one of the two. Taking the lock first, nothing waits on this
 * transaction while it waits.
 *
 * It sends no notifications, since it cannot know when the caller commits: pass `accepted`
 * to notifyRequestsAccepted once the transaction has.
 */
export async function acceptAllPending(
  tx: SweepTx,
  ownerId: string
): Promise<{ accepted: string[] }> {
  await lockOwner(tx, ownerId);

  // Claimed in one statement: the rows this DELETE returns are the rows it removed, so each
  // becomes a follow exactly once and nothing is read that is not also taken. A findMany
  // then deleteMany leaves a gap between the two in which a cancelled request is still on
  // the list, and becomes a follow nobody wants.
  const claimed = await tx.$queryRaw<{ requesterId: string }[]>`
    DELETE FROM "follow_requests" WHERE "targetId" = ${ownerId} RETURNING "requesterId"
  `;
  const accepted = claimed.map((row) => row.requesterId);

  if (accepted.length > 0) {
    await tx.follow.createMany({
      data: accepted.map((followerId) => ({ followerId, followingId: ownerId })),
      skipDuplicates: true,
    });
  }
  return { accepted };
}

/**
 * The sweep's notifications, for its caller to send after the commit: each requester gets
 * "aceptó tu solicitud", and the owner's doorbell for each request goes. One requester at a
 * time — an account with hundreds pending would otherwise ask the connection pool for
 * hundreds of connections at once, and a slower save beats a pool timeout. Never throws.
 */
export async function notifyRequestsAccepted(
  ownerId: string,
  requesterIds: readonly string[]
): Promise<void> {
  for (const requesterId of requesterIds) {
    await announceAccepted(ownerId, requesterId);
  }
}

// ---------------------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

/**
 * The two locks every pair writer takes first — see the top of this file. The pair key has
 * the follower first: A following B and B following A are different pairs, with different
 * owners.
 */
async function lockPair(
  tx: Pick<Tx, '$executeRaw'>,
  followerId: string,
  followedId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${FOLLOW_OWNER_LOCK}::int, hashtext(${followedId}))`;
  const pair = `${followerId}:${followedId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FOLLOW_PAIR_LOCK}::int, hashtext(${pair}))`;
}

/** The sweep's lock: the owner lock, exclusive, so no pair writer on the account runs beside it. */
async function lockOwner(tx: Pick<Tx, '$executeRaw'>, ownerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FOLLOW_OWNER_LOCK}::int, hashtext(${ownerId}))`;
}

/** Whether the account is private right now. Call it with the owner lock held. */
async function isPrivateNow(tx: Pick<Tx, 'user'>, userId: string): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { isPrivate: true } });
  if (!user) throw new FollowError('user.notFound', 'User not found');
  return user.isPrivate;
}

/**
 * Delete the pair's request, THEN its follow. Call it with the pair lock held.
 *
 * Under the lock the order cannot matter; it is kept for the day a writer forgets the lock.
 * Picture an accept committing while this delete waits on the request row it is about to
 * remove. Request first: the wait ends with that row gone, and the follows delete, which
 * starts after it with a fresh snapshot, sees the accepted follow, removes it and reports
 * it. Follows first: that delete runs before the accept inserts, finds nothing, and the
 * answer is "there was nothing" while a follow — and a "aceptó tu solicitud" — stands.
 */
async function removeBoth(
  tx: Pick<Tx, 'follow' | 'followRequest'>,
  followerId: string,
  followedId: string
): Promise<{ request: boolean; follow: boolean }> {
  const request = await tx.followRequest.deleteMany({
    where: { requesterId: followerId, targetId: followedId },
  });
  const follow = await tx.follow.deleteMany({
    where: { followerId, followingId: followedId },
  });
  return { request: request.count > 0, follow: follow.count > 0 };
}

/** An account deleted after the caller read it: the insert trips its foreign key. */
function rethrowGoneAccount(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new FollowError('user.notFound', 'User not found');
  }
  throw error;
}

/** The requester hears "aceptó tu solicitud"; the owner's doorbell for the request goes. */
async function announceAccepted(ownerId: string, requesterId: string): Promise<void> {
  await bestEffort('delete the follow request notification', (notifications) =>
    notifications.deleteFollowRequestNotification(requesterId, ownerId)
  );
  await bestEffort('create the follow accepted notification', (notifications) =>
    notifications.createFollowAcceptedNotification(ownerId, requesterId)
  );
}

/**
 * Built here rather than taken from the container. container.ts constructs every
 * repository when it is imported, and the profile update that runs the sweep lives in one
 * of them — so importing the container from this file closes a loop (UserRepository →
 * follows → container → UserRepository), and whichever end loads first meets the other
 * half-built. Built on first use, so importing this file constructs nothing.
 */
let notificationService: INotificationService | undefined;

/** A notification write after the commit: a failure is logged, never thrown. */
async function bestEffort(
  what: string,
  write: (notifications: INotificationService) => Promise<void>
): Promise<void> {
  try {
    notificationService ??= new NotificationService(new NotificationRepository(prisma));
    await write(notificationService);
  } catch (error) {
    logServerError(`Failed to ${what}:`, error);
  }
}
