import type { FollowState } from '@/domain/types/follow';
import type { Prisma } from '@prisma/client';

/**
 * Where a viewer stands with accounts: 'following', 'requested' or 'none' (FollowState).
 *
 * Read only here, so the two rules below are written once:
 * - a follow outranks a request. The follow is what grants access, and a pair in both
 *   tables — which the writers in requests.ts never leave — must still show "Siguiendo",
 *   whose tap clears both;
 * - a request counts only while its target is PRIVATE. Following a public account is
 *   immediate, so a request left over from when it was private means nothing, and showing
 *   "Solicitado" on it would leave the viewer waiting on an approval nobody is asked for.
 *   The next follow deletes the leftover. The filter is in the query, on the target row,
 *   so no caller has to remember it.
 */

/** What the readers need: `prisma`, or the `tx` of a transaction. */
export type FollowStateDb = Pick<Prisma.TransactionClient, 'follow' | 'followRequest'>;

/**
 * The viewer's state with every account in `targetIds` — for the followers and following
 * lists, whatever their length: one query per table, never one per account. Every id asked
 * about is in the map. Signed out (`viewerId` null) is 'none' for all, without a query.
 */
export async function followStatesFor(
  db: FollowStateDb,
  viewerId: string | null,
  targetIds: readonly string[]
): Promise<Map<string, FollowState>> {
  const states = new Map<string, FollowState>(targetIds.map((id) => [id, 'none']));
  if (viewerId === null || states.size === 0) return states;

  const ids = [...states.keys()];
  const [follows, requests] = await Promise.all([
    db.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true },
    }),
    db.followRequest.findMany({
      where: { requesterId: viewerId, targetId: { in: ids }, target: { isPrivate: true } },
      select: { targetId: true },
    }),
  ]);

  for (const { targetId } of requests) states.set(targetId, 'requested');
  // After the requests, so a follow overwrites one
  for (const { followingId } of follows) states.set(followingId, 'following');
  return states;
}

/** The viewer's state with one account — the profile header's follow button. */
export async function followStateOf(
  db: FollowStateDb,
  viewerId: string | null,
  targetId: string
): Promise<FollowState> {
  const states = await followStatesFor(db, viewerId, [targetId]);
  return states.get(targetId) ?? 'none';
}
