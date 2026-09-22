/**
 * @jest-environment node
 *
 * PUT /api/users/profile through the real UserService and UserRepository, over a mocked
 * Prisma: what a save does to the pending follow requests of the account it saves.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/container/container', () => ({ container: { getUserService: jest.fn() } }));
jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logServerError: jest.fn() }));
// The sweep and its notifications are tested in src/lib/follows. Here they only have to run,
// or not, at the right moment.
jest.mock('@/lib/follows/requests', () => ({
  acceptAllPending: jest.fn(),
  notifyRequestsAccepted: jest.fn(),
}));

import { UserRepository } from '@/infrastructure/repositories/UserRepository';
import { UserService } from '@/infrastructure/services/UserService';
import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { acceptAllPending, notifyRequestsAccepted } from '@/lib/follows/requests';
import { PUT } from '../users/profile/route';
import type { PrismaClient, User } from '@prisma/client';

const OWNER = 'owner-1';

function row(isPrivate: boolean): User {
  return {
    id: OWNER,
    email: 'owner@example.com',
    username: 'owner',
    password: 'hashed',
    fullName: 'Owner',
    bio: 'Guisos',
    avatar: null,
    website: null,
    role: 'USER',
    isVerified: false,
    isPrivate,
    passwordChangedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/**
 * The client, with its transaction run inline against a separate `tx`. `committed` is called
 * when the callback has returned — the moment the real transaction commits — so a test can
 * tell what ran inside it from what ran after.
 */
function mockPrisma() {
  const tx = { user: { update: jest.fn() } };
  const committed = jest.fn();
  const prisma = {
    user: { update: jest.fn() },
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => {
      const result = await work(tx);
      committed();
      return result;
    }),
  };
  return { prisma, tx, committed };
}

let db: ReturnType<typeof mockPrisma>;

beforeEach(() => {
  jest.clearAllMocks();
  db = mockPrisma();
  (container.getUserService as jest.Mock).mockReturnValue(
    new UserService(new UserRepository(db.prisma as unknown as PrismaClient))
  );
  (requireAuth as jest.Mock).mockResolvedValue({ id: OWNER });
});

function save(body: Record<string, unknown>) {
  return PUT(
    new NextRequest('http://localhost:3000/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

const firstCall = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];

describe('PUT /api/users/profile — making a private account public', () => {
  it('accepts every pending request in the save, and tells the requesters once it has committed', async () => {
    (acceptAllPending as jest.Mock).mockResolvedValue({ accepted: ['req-1', 'req-2'] });
    db.tx.user.update.mockResolvedValue(row(false));

    const response = await save({ isPrivate: false });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: OWNER, isPrivate: false });
    expect(body.data).not.toHaveProperty('password');

    // One transaction: the sweep, then the update, then the commit
    expect(acceptAllPending).toHaveBeenCalledWith(db.tx, OWNER);
    expect(db.tx.user.update).toHaveBeenCalledWith({
      where: { id: OWNER },
      data: expect.objectContaining({ isPrivate: false }),
    });
    expect(db.prisma.user.update).not.toHaveBeenCalled();
    expect(firstCall(acceptAllPending as jest.Mock)).toBeLessThan(firstCall(db.tx.user.update));

    // Told only after the commit: nobody hears "accepted" about a save that rolled back
    expect(notifyRequestsAccepted).toHaveBeenCalledWith(OWNER, ['req-1', 'req-2']);
    expect(firstCall(db.committed)).toBeLessThan(firstCall(notifyRequestsAccepted as jest.Mock));
  });

  it('answers 500 and saves nothing when the sweep fails, and nobody is told', async () => {
    // One transaction, so the failed sweep takes the update down with it: the account is
    // still private with its requests pending, and the 500 says exactly that
    (acceptAllPending as jest.Mock).mockRejectedValue(new Error('lock timeout'));

    const response = await save({ isPrivate: false, bio: 'Nuevo' });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, code: 'serverError' });
    expect(db.tx.user.update).not.toHaveBeenCalled();
    expect(db.prisma.user.update).not.toHaveBeenCalled();
    expect(db.committed).not.toHaveBeenCalled();
    expect(notifyRequestsAccepted).not.toHaveBeenCalled();
  });

  it('answers 500 when the update fails after the sweep, and nobody is told', async () => {
    (acceptAllPending as jest.Mock).mockResolvedValue({ accepted: ['req-1'] });
    db.tx.user.update.mockRejectedValue(new Error('connection lost'));

    const response = await save({ isPrivate: false });

    expect(response.status).toBe(500);
    expect(db.committed).not.toHaveBeenCalled();
    expect(notifyRequestsAccepted).not.toHaveBeenCalled();
  });
});

describe('PUT /api/users/profile — any save that leaves the account private', () => {
  // The route never reads what the account was: a save's body decides. Each of these is what
  // a client sends for that change.
  it.each([
    ['public → private', { isPrivate: true }],
    ['private → private, from a form that sends privacy only when flipped', { bio: 'Nuevo' }],
    [
      'private → private, from an older form that sends it on every save',
      { bio: 'Nuevo', isPrivate: true },
    ],
  ])('%s: accepts no request', async (_, body) => {
    db.prisma.user.update.mockResolvedValue(row(true));

    const response = await save(body);

    expect(response.status).toBe(200);
    expect(acceptAllPending).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.prisma.user.update).toHaveBeenCalledWith({
      where: { id: OWNER },
      data: expect.objectContaining(body),
    });
    // Called with nobody, which tells nobody
    expect(notifyRequestsAccepted).toHaveBeenCalledWith(OWNER, []);
  });
});
