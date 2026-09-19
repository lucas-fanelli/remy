import { PasswordResetToken } from '@prisma/client';

export type IssuePasswordResetTokenDTO = {
  userId: string;
  tokenHash: string; // SHA-256 hex digest — the raw token is never persisted
  expiresAt: Date;
  now: Date;
  /** No new token while the account's latest one is younger than this */
  throttleMs: number;
  /** No new token once the account has this many in the last 24 hours */
  maxPerDay: number;
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
  /**
   * Atomically apply the request limits and issue a token. Serialised per
   * account, so parallel requests cannot all pass a check-then-act throttle:
   * at most one of them creates a row. When a token is issued, the account's
   * earlier links stop working (only the newest link is valid).
   * Resolves null when the request was throttled, capped, or lost the race to
   * a request for the same account that is still in flight.
   */
  issue(data: IssuePasswordResetTokenDTO): Promise<PasswordResetToken | null>;

  // Read
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;

  // Delete
  /** Withdraw a token whose email never left, so it neither works nor throttles a retry */
  deleteById(id: string): Promise<void>;

  /**
   * Atomically redeem a token: claim it (only if still unused and unexpired),
   * store the new password hash, stamp passwordChangedAt and drop the user's
   * other reset tokens. Resolves false when the token could not be claimed,
   * e.g. a concurrent request redeemed it first.
   */
  redeem(data: RedeemPasswordResetTokenDTO): Promise<boolean>;
}
