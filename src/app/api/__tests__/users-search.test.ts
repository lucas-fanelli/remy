/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * GET /api/users/search — people, found by name.
 *
 * Private accounts are among the results now, so each row must be the profile header and
 * nothing else. The route used to spread whatever the service handed it, minus email and id,
 * and sent the role, verification, website and dates of everyone it found. It had no test.
 */

const mockSearchUsers = jest.fn();
jest.mock('@/lib/container/container', () => ({
  container: { getUserService: () => ({ searchUsers: mockSearchUsers }) },
}));

import { GET } from '../users/search/route';

/** A whole account, as a service could hand it over: more than the route may send. */
const account = (username: string, isPrivate: boolean) => ({
  id: `id-${username}`,
  email: `${username}@example.com`,
  username,
  fullName: `The ${username}`,
  bio: 'Cocino los domingos',
  avatar: null,
  website: 'https://example.com',
  role: 'ADMIN',
  isVerified: true,
  isPrivate,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
});

const search = async (query: string) => {
  const response = await GET(
    new NextRequest(`http://localhost:3000/api/users/search?query=${query}`)
  );
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/users/search', () => {
  it('sends each account’s header, and nothing more, private accounts included', async () => {
    mockSearchUsers.mockResolvedValue([account('marta', true), account('mario', false)]);

    const { status, body } = await search('mar');

    expect(status).toBe(200);
    expect(body.data).toEqual([
      {
        id: 'id-marta',
        username: 'marta',
        fullName: 'The marta',
        avatar: null,
        bio: 'Cocino los domingos',
        isPrivate: true,
      },
      {
        id: 'id-mario',
        username: 'mario',
        fullName: 'The mario',
        avatar: null,
        bio: 'Cocino los domingos',
        isPrivate: false,
      },
    ]);
  });

  it('searches with the default limit when none is asked for', async () => {
    // The absent parameter used to reach the schema as null, which coerces to 0 and failed
    // its `positive()`: every search without ?limit= was answered 400.
    mockSearchUsers.mockResolvedValue([]);

    const { status } = await search('marta');

    expect(status).toBe(200);
    expect(mockSearchUsers).toHaveBeenCalledWith('marta', 20);
  });

  it('answers 400 for an empty query, without searching', async () => {
    const { status } = await search('');

    expect(status).toBe(400);
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });
});
