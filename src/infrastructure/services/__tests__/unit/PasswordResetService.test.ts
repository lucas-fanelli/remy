/**
 * @jest-environment node
 */
import { createHash } from 'crypto';
import { PasswordResetToken, User } from '@prisma/client';
import { mock, MockProxy } from 'jest-mock-extended';
import { InvalidResetTokenError, ValidationError } from '@/domain/errors';
import {
  IPasswordResetTokenRepository,
  IssuePasswordResetTokenDTO,
} from '@/domain/repositories/IPasswordResetTokenRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IEmailService } from '@/domain/services/IEmailService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import {
  PasswordResetService,
  RESET_REQUEST_DAILY_LIMIT,
  RESET_REQUEST_THROTTLE_MS,
  hashResetToken,
} from '../../PasswordResetService';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const BASE_URL = 'https://remy-recipes.com';

const user: User = {
  id: 'user-123',
  email: 'chef@example.com',
  username: 'chef',
  password: 'old_hash',
  fullName: null,
  bio: null,
  avatar: null,
  website: null,
  role: 'USER',
  isVerified: false,
  isPrivate: false,
  passwordChangedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function tokenRecord(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  return {
    id: 'token-1',
    userId: user.id,
    tokenHash: 'hash',
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

/**
 * In-memory stand-in that honours the repository contract the way the database
 * does (one request per account at a time), with async gaps in the places where
 * a check-then-act implementation would race.
 */
class InMemoryTokenRepository implements IPasswordResetTokenRepository {
  rows: PasswordResetToken[] = [];
  private readonly busy = new Set<string>();

  async issue(data: IssuePasswordResetTokenDTO): Promise<PasswordResetToken | null> {
    await Promise.resolve();
    if (this.busy.has(data.userId)) return null;
    this.busy.add(data.userId);
    try {
      await Promise.resolve();
      const mine = this.rows.filter((row) => row.userId === data.userId);
      const latest = Math.max(...mine.map((row) => row.createdAt.getTime()));
      if (data.now.getTime() - latest < data.throttleMs) return null;
      if (mine.length >= data.maxPerDay) return null;

      await Promise.resolve();
      mine.forEach((row) => (row.expiresAt = data.now));
      const row = tokenRecord({
        id: `token-${this.rows.length + 1}`,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdAt: data.now,
      });
      this.rows.push(row);
      return row;
    } finally {
      this.busy.delete(data.userId);
    }
  }

  liveTokens(at: Date): PasswordResetToken[] {
    return this.rows.filter((row) => !row.usedAt && row.expiresAt.getTime() > at.getTime());
  }

  async findByTokenHash(): Promise<PasswordResetToken | null> {
    return null;
  }

  async deleteById(id: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== id);
  }

  async redeem(): Promise<boolean> {
    return false;
  }
}

describe('PasswordResetService - Unit Tests', () => {
  let users: MockProxy<IUserRepository>;
  let tokens: MockProxy<IPasswordResetTokenRepository>;
  let passwords: MockProxy<IPasswordService>;
  let email: MockProxy<IEmailService>;
  let getBaseUrl: jest.Mock<string | null, []>;
  let service: PasswordResetService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    users = mock<IUserRepository>();
    tokens = mock<IPasswordResetTokenRepository>();
    passwords = mock<IPasswordService>();
    email = mock<IEmailService>();
    getBaseUrl = jest.fn().mockReturnValue(BASE_URL);

    users.findByEmail.mockResolvedValue(user);
    users.findByUsername.mockResolvedValue(user);
    users.findAllByEmailIgnoringCase.mockResolvedValue([]);
    users.findAllByUsernameIgnoringCase.mockResolvedValue([]);
    tokens.issue.mockResolvedValue(tokenRecord());
    tokens.deleteById.mockResolvedValue();
    email.send.mockResolvedValue(true);

    service = new PasswordResetService(users, tokens, passwords, email, getBaseUrl);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** The raw token only ever leaves the service inside the emailed link */
  function sentToken(): string {
    const message = email.send.mock.calls[0][0];
    const link = message.text.match(/https?:\/\/\S+/)?.[0] ?? '';
    return new URL(link).searchParams.get('token') ?? '';
  }

  describe('hashResetToken', () => {
    it('should return the SHA-256 hex digest of the token', () => {
      const expected = createHash('sha256').update('abc').digest('hex');

      expect(hashResetToken('abc')).toBe(expected);
    });
  });

  describe('requestReset - account lookup', () => {
    it('should look the account up by email when the identifier has an @', async () => {
      await service.requestReset('chef@example.com');

      expect(users.findByEmail).toHaveBeenCalledWith('chef@example.com');
      expect(users.findByUsername).not.toHaveBeenCalled();
    });

    it('should look the account up by username otherwise', async () => {
      await service.requestReset('chef');

      expect(users.findByUsername).toHaveBeenCalledWith('chef');
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it('should ignore surrounding whitespace in the identifier', async () => {
      await service.requestReset('  chef  ');

      expect(users.findByUsername).toHaveBeenCalledWith('chef');
    });

    it('should resolve without creating a token or sending email for an unknown account', async () => {
      // Arrange
      users.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.requestReset('nobody@example.com');

      // Assert
      expect(result).toBeUndefined();
      expect(tokens.issue).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('should not fall back to a case-insensitive lookup when the exact match exists', async () => {
      await service.requestReset('chef');

      expect(users.findAllByUsernameIgnoringCase).not.toHaveBeenCalled();
      expect(users.findAllByEmailIgnoringCase).not.toHaveBeenCalled();
    });

    it('should find an account whose username was registered with different casing', async () => {
      // Arrange - registered as "Chef" on a phone keyboard, typed as "chef" here
      users.findByUsername.mockResolvedValue(null);
      users.findAllByUsernameIgnoringCase.mockResolvedValue([{ ...user, username: 'Chef' }]);

      // Act
      await service.requestReset('chef');

      // Assert
      expect(users.findAllByUsernameIgnoringCase).toHaveBeenCalledWith('chef');
      expect(tokens.issue.mock.calls[0][0].userId).toBe('user-123');
      expect(email.send).toHaveBeenCalledTimes(1);
    });

    it('should find an account whose email was registered with different casing', async () => {
      // Arrange
      users.findByEmail.mockResolvedValue(null);
      users.findAllByEmailIgnoringCase.mockResolvedValue([{ ...user, email: 'Chef@Example.com' }]);

      // Act
      await service.requestReset('chef@example.com');

      // Assert
      expect(users.findAllByEmailIgnoringCase).toHaveBeenCalledWith('chef@example.com');
      expect(email.send.mock.calls[0][0].to).toBe('Chef@Example.com');
    });

    it('should do nothing when ignoring case matches more than one account', async () => {
      // Arrange - "Chef" and "CHEF" are two accounts: never guess between them
      users.findByUsername.mockResolvedValue(null);
      users.findAllByUsernameIgnoringCase.mockResolvedValue([
        { ...user, id: 'user-1', username: 'Chef' },
        { ...user, id: 'user-2', username: 'CHEF' },
      ]);

      // Act
      await service.requestReset('chef');

      // Assert
      expect(tokens.issue).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('should resolve the same way for a known account', async () => {
      const result = await service.requestReset('chef@example.com');

      expect(result).toBeUndefined();
    });
  });

  describe('requestReset - token', () => {
    it('should generate 32 random bytes encoded as base64url', async () => {
      await service.requestReset('chef');

      const token = sentToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    });

    it('should store only the SHA-256 hash of the token', async () => {
      await service.requestReset('chef');

      const stored = tokens.issue.mock.calls[0][0];
      expect(stored.tokenHash).toBe(hashResetToken(sentToken()));
      expect(JSON.stringify(stored)).not.toContain(sentToken());
    });

    it('should make the token expire 60 minutes from now', async () => {
      await service.requestReset('chef');

      expect(tokens.issue.mock.calls[0][0].expiresAt).toEqual(new Date('2026-01-01T13:00:00.000Z'));
    });

    it('should attach the token to the matched user', async () => {
      await service.requestReset('chef');

      expect(tokens.issue.mock.calls[0][0].userId).toBe('user-123');
    });

    it('should generate a different token for every request', async () => {
      await service.requestReset('chef');
      const first = sentToken();
      email.send.mockClear();

      await service.requestReset('chef');

      expect(sentToken()).not.toBe(first);
    });

    it('should leave the limits and the invalidation of earlier links to one atomic issue call', async () => {
      await service.requestReset('chef');

      expect(tokens.issue).toHaveBeenCalledTimes(1);
      expect(tokens.issue).toHaveBeenCalledWith(
        expect.objectContaining({
          now: NOW,
          throttleMs: RESET_REQUEST_THROTTLE_MS,
          maxPerDay: RESET_REQUEST_DAILY_LIMIT,
        })
      );
    });

    it('should allow one request every 2 minutes and 5 per day', () => {
      expect(RESET_REQUEST_THROTTLE_MS).toBe(2 * 60 * 1000);
      expect(RESET_REQUEST_DAILY_LIMIT).toBe(5);
    });
  });

  describe('requestReset - throttle', () => {
    it('should silently send nothing when the request was throttled, capped or a duplicate', async () => {
      // Arrange
      tokens.issue.mockResolvedValue(null);

      // Act
      const result = await service.requestReset('chef');

      // Assert
      expect(result).toBeUndefined();
      expect(email.send).not.toHaveBeenCalled();
      expect(tokens.deleteById).not.toHaveBeenCalled();
    });

    describe('against a repository with real async gaps', () => {
      let memory: InMemoryTokenRepository;

      beforeEach(() => {
        memory = new InMemoryTokenRepository();
        service = new PasswordResetService(users, memory, passwords, email, getBaseUrl);
      });

      it('should send exactly one email when 10 requests for the same account arrive in parallel', async () => {
        // Act - what a burst of POST /api/auth/forgot-password for one victim looks like
        await Promise.all(Array.from({ length: 10 }, () => service.requestReset('chef')));

        // Assert
        expect(email.send).toHaveBeenCalledTimes(1);
        expect(memory.liveTokens(NOW)).toHaveLength(1);
      });

      it('should ignore a second request made less than 2 minutes after the first', async () => {
        await service.requestReset('chef');
        jest.setSystemTime(NOW.getTime() + RESET_REQUEST_THROTTLE_MS - 1);

        await service.requestReset('chef');

        expect(email.send).toHaveBeenCalledTimes(1);
      });

      it('should send a new link once the 2 minutes have passed and leave only that one working', async () => {
        await service.requestReset('chef');
        const later = new Date(NOW.getTime() + RESET_REQUEST_THROTTLE_MS);
        jest.setSystemTime(later);

        await service.requestReset('chef');

        expect(email.send).toHaveBeenCalledTimes(2);
        expect(memory.liveTokens(later)).toHaveLength(1);
      });

      it('should stop sending after 5 requests in a day', async () => {
        for (let i = 0; i < 7; i++) {
          jest.setSystemTime(NOW.getTime() + i * RESET_REQUEST_THROTTLE_MS);
          await service.requestReset('chef');
        }

        expect(email.send).toHaveBeenCalledTimes(RESET_REQUEST_DAILY_LIMIT);
      });

      it('should let an immediate retry through when the first email could not be delivered', async () => {
        // Arrange - the provider is down for the first attempt only
        email.send.mockResolvedValueOnce(false);

        // Act
        await service.requestReset('chef');
        await service.requestReset('chef');

        // Assert
        expect(email.send).toHaveBeenCalledTimes(2);
        expect(memory.liveTokens(NOW)).toHaveLength(1);
      });
    });
  });

  describe('requestReset - email', () => {
    it("should send the email to the account's stored address, not to what was typed", async () => {
      await service.requestReset('chef');

      expect(email.send.mock.calls[0][0].to).toBe('chef@example.com');
    });

    it('should build the link from the configured base URL', async () => {
      await service.requestReset('chef');

      const message = email.send.mock.calls[0][0];
      expect(message.text).toContain(`${BASE_URL}/auth/reset-password?token=${sentToken()}`);
    });

    it('should not create a token or send email when no public URL is configured', async () => {
      // Arrange
      getBaseUrl.mockReturnValue(null);

      // Act
      await service.requestReset('chef');

      // Assert
      expect(tokens.issue).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_APP_URL'));
    });

    it('should resolve normally when the email could not be delivered', async () => {
      // Arrange
      email.send.mockResolvedValue(false);

      // Act + Assert
      await expect(service.requestReset('chef')).resolves.toBeUndefined();
    });

    it('should withdraw the token when the email could not be delivered', async () => {
      // Arrange
      email.send.mockResolvedValue(false);
      tokens.issue.mockResolvedValue(tokenRecord({ id: 'token-undelivered' }));

      // Act
      await service.requestReset('chef');

      // Assert
      expect(tokens.deleteById).toHaveBeenCalledWith('token-undelivered');
    });

    it('should keep the token when the email was delivered', async () => {
      await service.requestReset('chef');

      expect(tokens.deleteById).not.toHaveBeenCalled();
    });

    it('should never log the raw token when delivery fails', async () => {
      // Arrange
      email.send.mockResolvedValue(false);

      // Act
      await service.requestReset('chef');

      // Assert
      const logged = [
        ...(console.warn as jest.Mock).mock.calls,
        ...(console.error as jest.Mock).mock.calls,
      ]
        .flat()
        .join(' ');
      expect(logged).not.toContain(sentToken());
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      passwords.validate.mockReturnValue(true);
      passwords.hash.mockResolvedValue('new_hash');
      tokens.findByTokenHash.mockResolvedValue(tokenRecord());
      tokens.redeem.mockResolvedValue(true);
    });

    it('should look the token up by its SHA-256 hash', async () => {
      await service.resetPassword('raw-token', 'NewPassword1');

      expect(tokens.findByTokenHash).toHaveBeenCalledWith(hashResetToken('raw-token'));
    });

    it('should redeem the token with the bcrypt hash of the new password', async () => {
      await service.resetPassword('raw-token', 'NewPassword1');

      expect(passwords.hash).toHaveBeenCalledWith('NewPassword1');
      expect(tokens.redeem).toHaveBeenCalledWith({
        tokenId: 'token-1',
        userId: 'user-123',
        hashedPassword: 'new_hash',
        now: NOW,
      });
    });

    it('should reject an unknown token with the generic error', async () => {
      tokens.findByTokenHash.mockResolvedValue(null);

      await expect(service.resetPassword('nope', 'NewPassword1')).rejects.toThrow(
        InvalidResetTokenError
      );
    });

    it('should reject a token that was already used with the generic error', async () => {
      tokens.findByTokenHash.mockResolvedValue(tokenRecord({ usedAt: NOW }));

      await expect(service.resetPassword('raw-token', 'NewPassword1')).rejects.toThrow(
        InvalidResetTokenError
      );
    });

    it('should reject an expired token with the generic error', async () => {
      tokens.findByTokenHash.mockResolvedValue(tokenRecord({ expiresAt: NOW }));

      await expect(service.resetPassword('raw-token', 'NewPassword1')).rejects.toThrow(
        InvalidResetTokenError
      );
    });

    it('should accept a token until the last millisecond before it expires', async () => {
      tokens.findByTokenHash.mockResolvedValue(
        tokenRecord({ expiresAt: new Date(NOW.getTime() + 1) })
      );

      await expect(service.resetPassword('raw-token', 'NewPassword1')).resolves.toBeUndefined();
    });

    it('should use the same message for unknown, used and expired tokens', async () => {
      // Arrange
      const messages: string[] = [];
      const attempts = [null, tokenRecord({ usedAt: NOW }), tokenRecord({ expiresAt: NOW })];

      // Act
      for (const record of attempts) {
        tokens.findByTokenHash.mockResolvedValue(record);
        await service
          .resetPassword('raw-token', 'NewPassword1')
          .catch((e) => messages.push(e.message));
      }

      // Assert
      expect(new Set(messages)).toEqual(new Set(['This reset link is invalid or has expired']));
      expect(messages).toHaveLength(3);
    });

    it('should not touch the password when the token is invalid', async () => {
      tokens.findByTokenHash.mockResolvedValue(null);

      await service.resetPassword('nope', 'NewPassword1').catch(() => {});

      expect(passwords.hash).not.toHaveBeenCalled();
      expect(tokens.redeem).not.toHaveBeenCalled();
    });

    it('should reject with the generic error when a concurrent request redeemed the token first', async () => {
      tokens.redeem.mockResolvedValue(false);

      await expect(service.resetPassword('raw-token', 'NewPassword1')).rejects.toThrow(
        InvalidResetTokenError
      );
    });

    it('should reject a password that breaks the password rules before looking at the token', async () => {
      passwords.validate.mockReturnValue(false);

      await expect(service.resetPassword('raw-token', 'weak')).rejects.toThrow(ValidationError);
      expect(tokens.findByTokenHash).not.toHaveBeenCalled();
    });
  });
});
