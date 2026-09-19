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

  describe('create', () => {
    it('should store the token hash, owner and expiry', async () => {
      prismaMock.passwordResetToken.create.mockResolvedValue(mockToken);

      const result = await repository.create({
        userId: 'user-123',
        tokenHash: mockToken.tokenHash,
        expiresAt: mockToken.expiresAt,
      });

      expect(result).toEqual(mockToken);
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          tokenHash: mockToken.tokenHash,
          expiresAt: mockToken.expiresAt,
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

  describe('findLatestByUserId', () => {
    it("should return the user's most recently created token", async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(mockToken);

      const result = await repository.findLatestByUserId('user-123');

      expect(result).toEqual(mockToken);
      expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteUnusedByUserId', () => {
    it("should delete only the user's unused tokens and return how many", async () => {
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await repository.deleteUnusedByUserId('user-123');

      expect(result).toBe(2);
      expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', usedAt: null },
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
