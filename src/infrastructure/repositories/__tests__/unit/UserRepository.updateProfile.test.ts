/**
 * @jest-environment node
 */
import { acceptAllPending } from '@/lib/follows/requests';
import { UserRepository } from '../../UserRepository';
import type { PrismaClient, User } from '@prisma/client';

// The sweep itself (its locks, the DELETE ... RETURNING, the follows it makes) is tested in
// src/lib/follows. Here it only has to run at the right moment, in the right transaction.
jest.mock('@/lib/follows/requests', () => ({ acceptAllPending: jest.fn() }));

const OWNER = 'owner-1';

function row(isPrivate: boolean): User {
  return {
    id: OWNER,
    email: 'owner@example.com',
    username: 'owner',
    password: 'hashed',
    fullName: 'Owner',
    bio: null,
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
 * The client, and the transaction it opens as a separate object, so a test can tell a write
 * made inside the transaction from one made beside it.
 */
function mockPrisma() {
  const tx = { user: { update: jest.fn() } };
  const prisma = {
    user: { update: jest.fn() },
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  return { prisma, tx, repository: new UserRepository(prisma as unknown as PrismaClient) };
}

const firstCall = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserRepository.updateProfile — a save that makes the account public', () => {
  it('accepts every pending request in the same transaction, before the update', async () => {
    const { prisma, tx, repository } = mockPrisma();
    (acceptAllPending as jest.Mock).mockResolvedValue({ accepted: ['req-1', 'req-2'] });
    tx.user.update.mockResolvedValue(row(false));

    const result = await repository.updateProfile(OWNER, { isPrivate: false, bio: 'Hola' });

    expect(acceptAllPending).toHaveBeenCalledWith(tx, OWNER);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: OWNER },
      data: { isPrivate: false, bio: 'Hola' },
    });
    // Sweep first: acceptAllPending's comment has the deadlock the other order risks
    expect(firstCall(acceptAllPending as jest.Mock)).toBeLessThan(firstCall(tx.user.update));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ user: row(false), accepted: ['req-1', 'req-2'] });
  });

  it('sweeps an account that was already public too, where it claims nothing', async () => {
    // Deliberate: telling "already public" apart would need a read of the old value, which
    // can be stale by the time the update lands (see updateProfile)
    const { tx, repository } = mockPrisma();
    (acceptAllPending as jest.Mock).mockResolvedValue({ accepted: [] });
    tx.user.update.mockResolvedValue(row(false));

    const result = await repository.updateProfile(OWNER, { isPrivate: false });

    expect(acceptAllPending).toHaveBeenCalledWith(tx, OWNER);
    expect(result.accepted).toEqual([]);
  });

  it('fails the whole save when the sweep fails, without attempting the update', async () => {
    const { tx, repository } = mockPrisma();
    (acceptAllPending as jest.Mock).mockRejectedValue(new Error('lock timeout'));

    await expect(repository.updateProfile(OWNER, { isPrivate: false })).rejects.toThrow(
      'lock timeout'
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('fails the whole save when the update fails after the sweep, reporting no one accepted', async () => {
    // Rolled back with the update, so nobody may be told they were accepted
    const { tx, repository } = mockPrisma();
    (acceptAllPending as jest.Mock).mockResolvedValue({ accepted: ['req-1'] });
    tx.user.update.mockRejectedValue(new Error('connection lost'));

    await expect(repository.updateProfile(OWNER, { isPrivate: false })).rejects.toThrow(
      'connection lost'
    );
  });
});

describe('UserRepository.updateProfile — any other save', () => {
  it.each([
    ['makes or keeps the account private', { isPrivate: true }],
    ['leaves privacy out', { bio: 'Hola' }],
  ])('does not sweep a save that %s: one plain update', async (_, data) => {
    const { prisma, repository } = mockPrisma();
    prisma.user.update.mockResolvedValue(row(true));

    const result = await repository.updateProfile(OWNER, data);

    expect(acceptAllPending).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: OWNER }, data });
    expect(result).toEqual({ user: row(true), accepted: [] });
  });
});
