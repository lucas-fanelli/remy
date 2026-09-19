import { PasswordResetToken } from '@prisma/client';

export type CreatePasswordResetTokenDTO = {
  userId: string;
  tokenHash: string; // SHA-256 hex digest — the raw token is never persisted
  expiresAt: Date;
};

export type RedeemPasswordResetTokenDTO = {
  tokenId: string;
  userId: string;
  hashedPassword: string;
  now: Date;
};

// Repository interface following Interface Segregation Principle (ISP)
// and Dependency Inversion Principle (DIP)
export interface IPasswordResetTokenRepository {
  // Create
  create(data: CreatePasswordResetTokenDTO): Promise<PasswordResetToken>;

  // Read
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  findLatestByUserId(userId: string): Promise<PasswordResetToken | null>;

  // Delete
  deleteUnusedByUserId(userId: string): Promise<number>;

  /**
   * Atomically redeem a token: claim it (only if still unused and unexpired),
   * store the new password hash, stamp passwordChangedAt and drop the user's
   * other reset tokens. Resolves false when the token could not be claimed,
   * e.g. a concurrent request redeemed it first.
   */
  redeem(data: RedeemPasswordResetTokenDTO): Promise<boolean>;
}
