import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { InvalidResetTokenError, ValidationError } from '@/domain/errors';
import { IPasswordResetTokenRepository } from '@/domain/repositories/IPasswordResetTokenRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IEmailService } from '@/domain/services/IEmailService';
import { IPasswordResetService } from '@/domain/services/IPasswordResetService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { buildPasswordResetEmail } from './passwordResetEmail';

export const RESET_TOKEN_TTL_MINUTES = 60;
export const RESET_REQUEST_THROTTLE_MS = 2 * 60 * 1000; // one email per account every 2 minutes
export const RESET_REQUEST_DAILY_LIMIT = 5; // and at most this many per account in 24 hours
export const RESET_PATH = '/auth/reset-password';
const RESET_TOKEN_BYTES = 32;

/** SHA-256 hex digest — the only form of a reset token that is ever persisted. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Single Responsibility Principle: Only handles the forgot / reset password flow
// Dependency Inversion Principle: Depends on abstractions (interfaces)
export class PasswordResetService implements IPasswordResetService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenRepository: IPasswordResetTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly emailService: IEmailService,
    // Server-side configuration only — never derived from the request (host header injection)
    private readonly getBaseUrl: () => string | null
  ) {}

  async requestReset(emailOrUsername: string): Promise<void> {
    const user = await this.findAccount(emailOrUsername.trim());

    if (!user) {
      return;
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      console.error(
        '[PASSWORD_RESET] No public app URL is configured (NEXT_PUBLIC_APP_URL); reset email not sent'
      );
      return;
    }

    // The limits (2 minute throttle, daily cap) and "only the newest link works"
    // are enforced inside one per-account serialised transaction: checking here
    // and inserting later would let a burst of parallel requests all pass.
    const now = new Date();
    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    const issued = await this.tokenRepository.issue({
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      now,
      throttleMs: RESET_REQUEST_THROTTLE_MS,
      maxPerDay: RESET_REQUEST_DAILY_LIMIT,
    });

    if (!issued) {
      // Throttled, capped or a duplicate of a request still in flight: stay silent
      return;
    }

    // The raw token exists only inside this link
    const resetUrl = `${baseUrl}${RESET_PATH}?token=${rawToken}`;
    const sent = await this.emailService.send(
      buildPasswordResetEmail({
        to: user.email,
        username: user.username,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      })
    );

    if (!sent) {
      console.warn(`[PASSWORD_RESET] Reset email for user ${user.id} was not delivered`);
      // Nobody holds this link: withdraw it so it does not throttle an immediate
      // retry or use up one of the account's daily requests
      await this.tokenRepository.deleteById(issued.id);
    }
  }

  /**
   * Same lookup rule as login, but forgiving about letter case: phone keyboards
   * capitalise "Lucas" at sign-up and the recovery form asks for it in lower
   * case. The unique indexes are case-sensitive, so "A@x.com" and "a@x.com" can
   * be two accounts: the exact match wins, and a case-insensitive match is only
   * accepted when it is unambiguous. The email always goes to the address on
   * file, never to what was typed.
   */
  private async findAccount(identifier: string): Promise<User | null> {
    const isEmail = identifier.includes('@');

    const exact = isEmail
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);
    if (exact) {
      return exact;
    }

    const candidates = isEmail
      ? await this.userRepository.findAllByEmailIgnoringCase(identifier)
      : await this.userRepository.findAllByUsernameIgnoringCase(identifier);

    return candidates.length === 1 ? candidates[0] : null;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this.passwordService.validate(newPassword)) {
      throw new ValidationError(
        'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
      );
    }

    const record = await this.tokenRepository.findByTokenHash(hashResetToken(token));

    // Unknown, used and expired tokens all fail the same way
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new InvalidResetTokenError();
    }

    const hashedPassword = await this.passwordService.hash(newPassword);

    // Timestamp taken after hashing: it becomes passwordChangedAt, the cut-off
    // before which every issued session is rejected. The repository re-checks
    // "unused and unexpired" against it inside the transaction.
    const redeemed = await this.tokenRepository.redeem({
      tokenId: record.id,
      userId: record.userId,
      hashedPassword,
      now: new Date(),
    });

    if (!redeemed) {
      // A concurrent request claimed the token between the lookup and the transaction
      throw new InvalidResetTokenError();
    }
  }
}
