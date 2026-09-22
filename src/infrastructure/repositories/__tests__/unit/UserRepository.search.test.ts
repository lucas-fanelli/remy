import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UserRepository } from '../../UserRepository';

/**
 * People search. It hid private accounts until follow requests, and an account nobody can
 * find is one nobody can ask to follow — for a private account, the only way in. Finding one
 * must show its header and nothing more, so the select is checked as closely as the filter.
 */
describe('UserRepository.search', () => {
  let prismaMock: DeepMockProxy<PrismaClient>;
  let userRepository: UserRepository;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    userRepository = new UserRepository(prismaMock);
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  const searchArgs = () => prismaMock.user.findMany.mock.calls[0][0];

  it('finds private accounts too: it matches on the name alone', async () => {
    await userRepository.search('marta');

    expect(searchArgs()?.where).toEqual({
      OR: [
        { username: { contains: 'marta', mode: 'insensitive' } },
        { fullName: { contains: 'marta', mode: 'insensitive' } },
      ],
    });
  });

  it('reads the profile header and nothing more', async () => {
    // What a locked profile shows anyone. No email or password; no website, role,
    // verification or dates, which a private account's own profile keeps to its followers
    // or never shows at all.
    await userRepository.search('marta');

    expect(searchArgs()?.select).toEqual({
      id: true,
      username: true,
      fullName: true,
      bio: true,
      avatar: true,
      isPrivate: true,
    });
  });

  it('pages newest first', async () => {
    await userRepository.search('marta', 5, 10);

    expect(searchArgs()).toEqual(
      expect.objectContaining({ take: 5, skip: 10, orderBy: { createdAt: 'desc' } })
    );
  });
});
