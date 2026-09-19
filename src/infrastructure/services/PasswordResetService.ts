import { createHash, randomBytes } from 'crypto';
import { InvalidResetTokenError, ValidationError } from '@/domain/errors';
import { IPasswordResetTokenRepository } from '@/domain/repositories/IPasswordResetTokenRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IEmailService } from '@/domain/services/IEmailService';
import { IPasswordResetService } from '@/domain/services/IPasswordResetService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { buildPasswordResetEmail } from './passwordResetEmail';

export const RESET_TOKEN_TTL_MINUTES = 60;
export const RESET_REQUEST_THROTTLE_MS = 2 * 60 * 1000; // one email per account every 2 minutes
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
    const identifier = emailOrUsername.trim();

    // Same lookup rule as login
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);

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

    // Per-account throttle: silently ignore requests that come too close together
    const now = new Date();
    const latest = await this.tokenRepository.findLatestByUserId(user.id);
    if (latest && now.getTime() - latest.createdAt.getTime() < RESET_REQUEST_THROTTLE_MS) {
      return;
    }

    // Only the newest link may work
    await this.tokenRepository.deleteUnusedByUserId(user.id);

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    await this.tokenRepository.create({
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });

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
    }
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
