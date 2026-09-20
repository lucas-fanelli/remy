import { PasswordResetToken, PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PasswordResetTokenRepository } from '../../PasswordResetTokenRepository';

describe('PasswordResetTokenRepository - Unit Tests', () => {
  let repository: PasswordResetTokenRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

  const now = new Date('2026-01-01T12:00:00.000Z');

  const mockToken: PasswordResetToken = {
    id: 'token-1',
    userId: 'user-123',
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date('2026-01-01T13:00:00.000Z'),
    usedAt: null,
    createdAt: now,
  };

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    repository = new PasswordResetTokenRepository(prismaMock);

    // Run interactive transactions against the same mock client
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issue', () => {
    const issueData = {
      userId: 'user-123',
      tokenHash: mockToken.tokenHash,
      expiresAt: mockToken.expiresAt,
      now,
      throttleMs: 2 * 60 * 1000,
      maxPerDay: 5,
    };

    const minutesAgo = (minutes: number) => ({
      createdAt: new Date(now.getTime() - minutes * 60 * 1000),
    });

    beforeEach(() => {
      prismaMock.$queryRaw.mockResolvedValue([{ locked: true }]);
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.passwordResetToken.findMany.mockResolvedValue([]);
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.passwordResetToken.create.mockResolvedValue(mockToken);
    });

    it('should run inside a single transaction', async () => {
      await repository.issue(issueData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should take the per-account advisory lock before reading the recent tokens', async () => {
      await repository.issue(issueData);

      const [sql, ...values] = prismaMock.$queryRaw.mock.calls[0] as unknown as [
        string[],
        ...unknown[],
      ];
      expect(sql.join('?')).toContain('pg_try_advisory_xact_lock(?::int, hashtext(?))');
      expect(values).toEqual([48885, 'user-123']);
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.passwordResetToken.findMany.mock.invocationCallOrder[0]
      );
    });

    it('should resolve null without touching any row when the account is locked by a request in flight', async () => {
      // Arrange - a parallel request for the same account holds the lock
      prismaMock.$queryRaw.mockResolvedValue([{ locked: false }]);

      // Act
      const result = await repository.issue(issueData);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.passwordResetToken.findMany).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should resolve null when the latest token is younger than the throttle', async () => {
      prismaMock.passwordResetToken.findMany.mockResolvedValue([
        { createdAt: new Date(now.getTime() - issueData.throttleMs + 1) },
      ] as PasswordResetToken[]);

      const result = await repository.issue(issueData);

      expect(result).toBeNull();
      expect(prismaMock.passwordResetToken.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should issue a token once the throttle has passed', async () => {
      prismaMock.passwordResetToken.findMany.mockResolvedValue([
        { createdAt: new Date(now.getTime() - issueData.throttleMs) },
      ] as PasswordResetToken[]);

      const result = await repository.issue(issueData);

      expect(result).toEqual(mockToken);
    });

    it('should resolve null when the account reached the daily cap', async () => {
      prismaMock.passwordResetToken.findMany.mockResolvedValue(
        [10, 20, 30, 40, 50].map(minutesAgo) as PasswordResetToken[]
      );

      const result = await repository.issue(issueData);

      expect(result).toBeNull();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should issue a token while the account is under the daily cap', async () => {
      prismaMock.passwordResetToken.findMany.mockResolvedValue(
        [10, 20, 30, 40].map(minutesAgo) as PasswordResetToken[]
      );

      const result = await repository.issue(issueData);

      expect(result).toEqual(mockToken);
    });

    it('should count only the last 24 hours by dropping older rows first', async () => {
      await repository.issue(issueData);

      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', createdAt: { lt: new Date('2025-12-31T12:00:00.000Z') } },
      });
      expect(prismaMock.passwordResetToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.passwordResetToken.findMany.mock.invocationCallOrder[0]
      );
    });

    it("should expire the account's earlier live links before creating the new one", async () => {
      await repository.issue(issueData);

      expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      expect(prismaMock.passwordResetToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.passwordResetToken.create.mock.invocationCallOrder[0]
      );
    });

    it('should store the token hash, owner, expiry and the request time', async () => {
      const result = await repository.issue(issueData);

      expect(result).toEqual(mockToken);
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          tokenHash: mockToken.tokenHash,
          expiresAt: mockToken.expiresAt,
          createdAt: now,
        },
      });
    });
  });

  describe('findByTokenHash', () => {
    it('should look the token up by its unique hash', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken);

      const result = await repository.findByTokenHash(mockToken.tokenHash);

      expect(result).toEqual(mockToken);
      expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: mockToken.tokenHash },
      });
    });

    it('should return null when no token matches', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

      const result = await repository.findByTokenHash('missing');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should delete that token and tolerate it being gone already', async () => {
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(repository.deleteById('token-1')).resolves.toBeUndefined();

      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });
  });

  describe('redeem', () => {
    const redeemData = {
      tokenId: 'token-1',
      userId: 'user-123',
      hashedPassword: 'new_hash',
      now,
    };

    beforeEach(() => {
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('should run inside a single transaction', async () => {
      await repository.redeem(redeemData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should claim the token only while it is unused and unexpired', async () => {
      await repository.redeem(redeemData);

      expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', userId: 'user-123', usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
    });

    it('should store the new password hash and stamp passwordChangedAt', async () => {
      await repository.redeem(redeemData);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'new_hash', passwordChangedAt: now },
      });
    });

    it("should delete the user's other reset tokens and keep the redeemed one", async () => {
      await repository.redeem(redeemData);

      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', id: { not: 'token-1' } },
      });
    });

    it('should resolve true when the token was redeemed', async () => {
      await expect(repository.redeem(redeemData)).resolves.toBe(true);
    });

    it('should resolve false and change nothing when the token was already claimed', async () => {
      // Arrange - a concurrent request won the conditional update
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await repository.redeem(redeemData);

      // Assert
      expect(result).toBe(false);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    });
  });
});
