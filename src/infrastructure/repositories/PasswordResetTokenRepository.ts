import { PasswordResetToken, PrismaClient } from '@prisma/client';
import {
  IPasswordResetTokenRepository,
  IssuePasswordResetTokenDTO,
  RedeemPasswordResetTokenDTO,
} from '@/domain/repositories/IPasswordResetTokenRepository';
import { PG_ADVISORY_LOCK_PASSWORD_RESET } from '@/lib/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

// Concrete implementation of IPasswordResetTokenRepository
// Single Responsibility Principle: Only handles password reset token data access
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async issue(data: IssuePasswordResetTokenDTO): Promise<PasswordResetToken | null> {
    const { userId, tokenHash, expiresAt, now, throttleMs, maxPerDay } = data;
    const dayAgo = new Date(now.getTime() - DAY_MS);

    return this.prisma.$transaction(async (tx) => {
      // Per-account lock: without it, parallel requests all read "no recent token"
      // before any of them inserts, and every one of them sends an email.
      // try-lock instead of lock: a request that finds the account busy IS the
      // duplicate the throttle exists for, so it is dropped rather than queued
      // (and no pool connection is held while waiting).
      const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
        SELECT pg_try_advisory_xact_lock(${PG_ADVISORY_LOCK_PASSWORD_RESET}::int, hashtext(${userId})) AS locked
      `;
      if (!locked) {
        return null;
      }

      // Rows that left the 24 hour window no longer count towards anything
      await tx.passwordResetToken.deleteMany({
        where: { userId, createdAt: { lt: dayAgo } },
      });

      const recent = await tx.passwordResetToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      const latest = recent[0];
      if (latest && now.getTime() - latest.createdAt.getTime() < throttleMs) {
        return null;
      }
      if (recent.length >= maxPerDay) {
        return null;
      }

      // Only the newest link may work. Earlier ones are expired rather than
      // deleted: the rows are what the daily cap counts.
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });

      // createdAt comes from the same clock the throttle is measured with
      return tx.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt, createdAt: now },
      });
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async deleteById(id: string): Promise<void> {
    // deleteMany: a token that is already gone is not an error
    await this.prisma.passwordResetToken.deleteMany({ where: { id } });
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
