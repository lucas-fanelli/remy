import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';

/**
 * GET /api/follow-requests — the signed-in owner's pending follow requests: the inbox behind
 * "Solicitudes de seguimiento", where each one is accepted or declined
 * (./[username]/accept, ./[username]/decline).
 *
 *   ?limit=1..100 (default 20) &offset>=0
 *   200 { requests: [{ requester: { id, username, fullName, avatar }, createdAt }], total }
 *
 * - Newest first. `createdAt` is when the request was made.
 * - `total` counts every pending request, not only this page: the client uses it for the
 *   pinned count and to decide whether to offer "Cargar más".
 * - Only the requester's header goes out: the fields a locked profile shows anyone.
 * - The table is the truth here, not the notifications. A request whose "quiere seguirte"
 *   was deleted, marked read or pushed past the dropdown's last row is still listed and
 *   can still be answered.
 *
 * Read-only, so it reads "follow_requests" directly; writing it is src/lib/follows' alone.
 *
 * Errors: 401 unauthorized; 500 followRequest.listFailed.
 */
export async function GET(request: NextRequest) {
  try {
    let owner;
    try {
      owner = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    // Both ride @@index([targetId, createdAt])
    const where = { targetId: owner.id };
    const [rows, total] = await Promise.all([
      prisma.followRequest.findMany({
        where,
        // The id breaks ties between requests made in the same millisecond, so a row cannot
        // appear on two pages, or on neither, as "Cargar más" moves the offset.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          createdAt: true,
          requester: { select: { id: true, username: true, fullName: true, avatar: true } },
        },
      }),
      prisma.followRequest.count({ where }),
    ]);

    return NextResponse.json({ requests: rows, total });
  } catch (error) {
    logServerError('Error fetching follow requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch follow requests', code: 'followRequest.listFailed' },
      { status: 500 }
    );
  }
}
