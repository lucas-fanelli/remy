/**
 * @jest-environment node
 *
 * Every route reached through a recipe id asks canSeePost before anything else, and stops
 * on its answer.
 *
 * They used to check at most that the recipe existed — the rating DELETE and the comments
 * GET not even that — so anyone holding the id of a private author's recipe could read its
 * comments and scores, see its ingredients through the cook plan, and like, save, rate,
 * comment on and cook it, and be sent its like count and rating breakdown in return.
 *
 * Each route is sent the same four viewers. A refused one must leave with the 403 body and
 * nothing else, and the database must have been asked one thing only: who wrote the recipe.
 * A write, a count or a notification after that is the leak this closes.
 */
import { NextRequest } from 'next/server';

/**
 * A stand-in for `prisma`, or for the `tx` of its transactions: every table these routes
 * touch, with every method they call.
 */
function mockClient() {
  const table = () => ({
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  });
  return {
    post: table(),
    comment: table(),
    rating: table(),
    like: table(),
    savedRecipe: table(),
    userPantry: table(),
    cookedRecipe: table(),
    $executeRaw: jest.fn(),
  };
}

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { ...mockClient(), $transaction: jest.fn() },
}));
jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn(), getCurrentUser: jest.fn() }));
jest.mock('@/lib/container/container', () => ({
  container: { getNotificationService: jest.fn() },
}));

import { getCurrentUser, requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prismaClient from '@/lib/database/prisma';
import { POST as cookedPOST } from '../cooked-recipes/route';
import {
  DELETE as commentDELETE,
  PATCH as commentPATCH,
} from '../recipes/[id]/comments/[commentId]/route';
import { GET as commentsGET, POST as commentsPOST } from '../recipes/[id]/comments/route';
import { GET as cookPlanGET } from '../recipes/[id]/cook-plan/route';
import { POST as likePOST } from '../recipes/[id]/like/route';
import { DELETE as ratingDELETE, PUT as ratingPUT } from '../recipes/[id]/rating/route';
import { POST as savePOST } from '../recipes/[id]/save/route';

type Client = ReturnType<typeof mockClient>;

const prisma = prismaClient as unknown as Client & { $transaction: jest.Mock };
/**
 * What the routes' transactions run against — a client of its own, so a test can tell
 * whether the gate asked inside the transaction that then writes, or outside it.
 */
const tx = mockClient();

const RECIPE = '7e783849-1e07-4ac7-9b95-fe3a40fe622e';
const COMMENT = '0da1dbf8-1363-42fa-b78f-7ca1572150e0';
const AUTHOR = 'author-1';
const STRANGER = 'stranger-1';
const RECIPE_URL = `http://localhost:3000/api/recipes/${RECIPE}`;

let viewerId: string | null = null;

function signedInAs(id: string | null) {
  viewerId = id;
  (requireAuth as jest.Mock).mockImplementation(async () => {
    if (id === null) throw new Error('Authentication required');
    return { id };
  });
  (getCurrentUser as jest.Mock).mockResolvedValue(id === null ? null : { id });
}

/**
 * The recipe row, whole, whatever the select: canSeePost reads the author from it, and
 * cook-plan and mark-cooked then read the ingredients.
 */
function recipeIs(state: 'public' | 'private' | 'missing') {
  const row = {
    id: RECIPE,
    userId: AUTHOR,
    user: { isPrivate: state === 'private', username: 'marta' },
    ingredients: [{ name: 'flour', amount: '200', unit: 'g' }],
  };
  for (const db of [prisma, tx]) {
    db.post.findUnique.mockResolvedValue(state === 'missing' ? null : row);
  }
}

function send(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const recipeParams = () => ({ params: Promise.resolve({ id: RECIPE }) });
const commentParams = () => ({ params: Promise.resolve({ id: RECIPE, commentId: COMMENT }) });

/** Every query a route made, named like 'tx.post.findUnique'; the transaction wrapper aside. */
function queriesMade(): string[] {
  const clients: Array<[string, Record<string, unknown>]> = [
    ['prisma', prisma],
    ['tx', tx],
  ];
  return clients.flatMap(([clientName, client]) =>
    Object.entries(client).flatMap(([key, value]) => {
      if (key === '$transaction') return [];
      const methods: Array<[string, jest.Mock]> =
        typeof value === 'function'
          ? [['', value as jest.Mock]]
          : Object.entries(value as Record<string, jest.Mock>);
      return methods
        .filter(([, fn]) => fn.mock.calls.length > 0)
        .map(([method]) => [clientName, key, method].filter(Boolean).join('.'));
    })
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (client: Client) => unknown) => fn(tx));
  (container.getNotificationService as jest.Mock).mockReturnValue({
    createCommentNotification: jest.fn(),
    createLikeNotification: jest.fn(),
    deleteLikeNotification: jest.fn(),
  });

  // What each route finds once it is let in. Set on both clients, so a route reads the
  // same data whichever it asks.
  for (const db of [prisma, tx]) {
    db.comment.findMany.mockResolvedValue([]);
    db.comment.count.mockResolvedValue(0);
    db.rating.findMany.mockResolvedValue([]);
    db.comment.create.mockResolvedValue({ id: 'comment-2', text: 'Lovely', user: {} });
    // The comment being edited or deleted is always the viewer's own.
    db.comment.findUnique.mockImplementation(async () => ({
      id: COMMENT,
      postId: RECIPE,
      userId: viewerId,
    }));
    db.comment.update.mockResolvedValue({ id: COMMENT, text: 'Edited', user: {} });
    db.rating.findUnique.mockResolvedValue(null);
    db.like.findUnique.mockResolvedValue(null);
    db.like.count.mockResolvedValue(1);
    db.savedRecipe.findUnique.mockResolvedValue(null);
    db.rating.aggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: { rating: 1 } });
    db.rating.groupBy.mockResolvedValue([{ rating: 4, _count: { _all: 1 } }]);
    db.userPantry.findUnique.mockResolvedValue(null);
    db.cookedRecipe.count.mockResolvedValue(0);
    db.cookedRecipe.create.mockResolvedValue({ id: 'cooked-1', postId: RECIPE });
  }
});

interface RouteCase {
  route: string;
  call: () => Promise<Response>;
  /** A route that writes asks inside its transaction, with `tx`; a read-only one asks `prisma`. */
  gate: 'tx.post.findUnique' | 'prisma.post.findUnique';
  okStatus: number;
  /** What the route is for: reached by a viewer let in, never by one refused. */
  work: () => jest.Mock;
  arrange?: () => void;
}

const ROUTES: RouteCase[] = [
  {
    route: 'GET comments',
    call: () => commentsGET(send('GET', `${RECIPE_URL}/comments`), recipeParams()),
    gate: 'prisma.post.findUnique',
    okStatus: 200,
    work: () => prisma.comment.findMany,
  },
  {
    route: 'POST comments',
    call: () =>
      commentsPOST(send('POST', `${RECIPE_URL}/comments`, { text: 'Lovely' }), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.comment.create,
  },
  {
    route: 'PATCH your comment',
    call: () =>
      commentPATCH(
        send('PATCH', `${RECIPE_URL}/comments/${COMMENT}`, { text: 'Edited' }),
        commentParams()
      ),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.comment.update,
  },
  {
    route: 'DELETE your comment',
    call: () => commentDELETE(send('DELETE', `${RECIPE_URL}/comments/${COMMENT}`), commentParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.comment.delete,
  },
  {
    route: 'POST like { liked: true }',
    call: () => likePOST(send('POST', `${RECIPE_URL}/like`, { liked: true }), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.like.create,
  },
  {
    route: 'POST like { liked: false }',
    arrange: () => tx.like.findUnique.mockResolvedValue({ id: 'like-1' }),
    call: () => likePOST(send('POST', `${RECIPE_URL}/like`, { liked: false }), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.like.delete,
  },
  {
    route: 'POST like with no body (the legacy flip)',
    call: () => likePOST(send('POST', `${RECIPE_URL}/like`), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.like.create,
  },
  {
    route: 'POST save',
    call: () => savePOST(send('POST', `${RECIPE_URL}/save`, { saved: true }), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.savedRecipe.create,
  },
  {
    route: 'PUT rating',
    call: () => ratingPUT(send('PUT', `${RECIPE_URL}/rating`, { rating: 4 }), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.rating.upsert,
  },
  {
    route: 'DELETE rating',
    call: () => ratingDELETE(send('DELETE', `${RECIPE_URL}/rating`), recipeParams()),
    gate: 'tx.post.findUnique',
    okStatus: 200,
    work: () => tx.rating.deleteMany,
  },
  {
    route: 'GET cook-plan',
    call: () => cookPlanGET(send('GET', `${RECIPE_URL}/cook-plan`), recipeParams()),
    gate: 'prisma.post.findUnique',
    okStatus: 200,
    work: () => prisma.userPantry.findUnique,
  },
  {
    route: 'POST cooked-recipes',
    call: () =>
      cookedPOST(send('POST', 'http://localhost:3000/api/cooked-recipes', { postId: RECIPE })),
    gate: 'tx.post.findUnique',
    okStatus: 201,
    work: () => tx.cookedRecipe.create,
  },
];

describe.each(ROUTES)('$route', ({ call, gate, okStatus, work, arrange }) => {
  beforeEach(() => arrange?.());

  it('refuses a stranger on a private recipe, having asked only who wrote it', async () => {
    signedInAs(STRANGER);
    recipeIs('private');

    const response = await call();

    expect(response.status).toBe(403);
    // The whole body: no like count, no average or breakdown, no comments, no plan.
    expect(await response.json()).toEqual({
      error: 'This profile is private',
      code: 'user.profilePrivate',
      author: { username: 'marta' },
    });
    // One query, the gate's — on `tx` where the route writes, so the check and the write
    // it guards share a transaction.
    expect(queriesMade()).toEqual([gate]);
    expect(container.getNotificationService).not.toHaveBeenCalled();
  });

  it('lets the author in on their own private recipe', async () => {
    signedInAs(AUTHOR);
    recipeIs('private');

    const response = await call();

    expect(response.status).toBe(okStatus);
    expect(work()).toHaveBeenCalled();
  });

  it('lets anyone signed in through on a public recipe', async () => {
    signedInAs(STRANGER);
    recipeIs('public');

    const response = await call();

    expect(response.status).toBe(okStatus);
    expect(work()).toHaveBeenCalled();
  });

  it('answers 404 for a recipe that does not exist, and goes no further', async () => {
    signedInAs(STRANGER);
    recipeIs('missing');

    const response = await call();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Recipe not found', code: 'recipe.notFound' });
    expect(queriesMade()).toEqual([gate]);
  });
});

describe('GET comments, signed out', () => {
  const read = () => commentsGET(send('GET', `${RECIPE_URL}/comments`), recipeParams());

  it('still reads the thread of a public recipe', async () => {
    signedInAs(null);
    recipeIs('public');

    const response = await read();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ comments: [], total: 0 });
  });

  it('is refused the thread of a private recipe', async () => {
    signedInAs(null);
    recipeIs('private');

    const response = await read();

    expect(response.status).toBe(403);
    expect(queriesMade()).toEqual(['prisma.post.findUnique']);
  });
});

describe('the author canSeePost found is the one notified', () => {
  it('on a like', async () => {
    signedInAs(STRANGER);
    recipeIs('public');

    await likePOST(send('POST', `${RECIPE_URL}/like`, { liked: true }), recipeParams());

    const notifications = (container.getNotificationService as jest.Mock).mock.results[0].value;
    expect(notifications.createLikeNotification).toHaveBeenCalledWith(STRANGER, RECIPE, AUTHOR);
  });

  it('on a comment', async () => {
    signedInAs(STRANGER);
    recipeIs('public');

    await commentsPOST(send('POST', `${RECIPE_URL}/comments`, { text: 'Lovely' }), recipeParams());

    const notifications = (container.getNotificationService as jest.Mock).mock.results[0].value;
    expect(notifications.createCommentNotification).toHaveBeenCalledWith(
      STRANGER,
      RECIPE,
      AUTHOR,
      'comment-2'
    );
  });
});
