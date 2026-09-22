/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * GET /api/users/[username] — one person, as the reader may see them.
 *
 * It answered anyone, signed out included, with the whole row minus the email: `role`
 * (which names the admins), `isVerified`, `updatedAt`, and the website of a private account
 * that its own profile page hides. It had no test at all.
 */

// The privacy rule asks one thing of the database here: whether a signed-in reader follows
// a private account.
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { follow: { findUnique: jest.fn() }, post: {} },
}));

const mockGetCurrentUser = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockGetUserByUsername = jest.fn();
jest.mock('@/lib/container/container', () => ({
  container: { getUserService: () => ({ getUserByUsername: mockGetUserByUsername }) },
}));

import prisma from '@/lib/database/prisma';
import { GET } from '../users/[username]/route';

/** The account as UserService.getUserByUsername returns it: everything but the password. */
const account = (isPrivate: boolean) => ({
  id: 'owner-1',
  email: 'chef@example.com',
  username: 'chef',
  fullName: 'Chef Owner',
  bio: 'Cocino los domingos',
  avatar: null,
  website: 'https://chef.example.com',
  isPrivate,
  isVerified: true,
  role: 'ADMIN',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
});

const get = async (username = 'chef') => {
  const response = await GET(new NextRequest(`http://localhost/api/users/${username}`), {
    params: Promise.resolve({ username }),
  });
  return { status: response.status, body: await response.json() };
};

const HEADER = {
  id: 'owner-1',
  username: 'chef',
  fullName: 'Chef Owner',
  avatar: null,
  bio: 'Cocino los domingos',
};

describe('GET /api/users/[username]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    // Nobody follows anybody unless a test says so
    (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('never says who is an admin, or anything else the profile page does not show', async () => {
    mockGetUserByUsername.mockResolvedValue(account(false));

    const { body } = await get();

    expect(body.data.user).not.toHaveProperty('role');
    expect(body.data.user).not.toHaveProperty('isVerified');
    expect(body.data.user).not.toHaveProperty('updatedAt');
    expect(body.data.user).not.toHaveProperty('email');
  });

  it('shows a public account in full to a signed-out visitor', async () => {
    mockGetUserByUsername.mockResolvedValue(account(false));

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.data.user).toEqual({
      ...HEADER,
      isPrivate: false,
      website: 'https://chef.example.com',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('shows a private account to someone else as its header, and no more', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'stranger-1' });
    mockGetUserByUsername.mockResolvedValue(account(true));

    const { body } = await get();

    expect(body.data.user).toEqual({ ...HEADER, isPrivate: true });
  });

  it('shows a private account to its owner in full', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'owner-1' });
    mockGetUserByUsername.mockResolvedValue(account(true));

    const { body } = await get();

    expect(body.data.user.website).toBe('https://chef.example.com');
  });

  it('shows a private account to an accepted follower in full', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'follower-1' });
    mockGetUserByUsername.mockResolvedValue(account(true));
    (prisma.follow.findUnique as jest.Mock).mockResolvedValue({ id: 'follow-1' });

    const { body } = await get();

    expect(body.data.user.website).toBe('https://chef.example.com');
  });

  it('answers 404 for nobody, and 400 for a name that cannot be one', async () => {
    mockGetUserByUsername.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
    expect((await get('not a name!')).status).toBe(400);
  });
});
