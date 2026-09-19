import { PasswordResetToken, PrismaClient } from '@prisma/client';
import {
  IPasswordResetTokenRepository,
  CreatePasswordResetTokenDTO,
  RedeemPasswordResetTokenDTO,
} from '@/domain/repositories/IPasswordResetTokenRepository';

// Concrete implementation of IPasswordResetTokenRepository
// Single Responsibility Principle: Only handles password reset token data access
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePasswordResetTokenDTO): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async findLatestByUserId(userId: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteUnusedByUserId(userId: string): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });
    return result.count;
  }

  async redeem(data: RedeemPasswordResetTokenDTO): Promise<boolean> {
    const { tokenId, userId, hashedPassword, now } = data;

    return this.prisma.$transaction(async (tx) => {
      // Claim the token with a conditional update so two concurrent requests
      // carrying the same link cannot both succeed (single use).
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, userId, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword, passwordChangedAt: now },
      });

      // Any other outstanding link for this account dies with the old password
      await tx.passwordResetToken.deleteMany({
        where: { userId, id: { not: tokenId } },
      });

      return true;
    });
  }
}
