import { User, Role } from '@prisma/client';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import {
  IAuthService,
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  SessionUser,
  ValidatedSession,
} from '@/domain/services/IAuthService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { ITokenService, TokenPayload } from '@/domain/services/ITokenService';
import { getSessionRenewAfterSeconds } from '@/lib/auth/session';

// Single Responsibility Principle: Only handles authentication logic
// Dependency Inversion Principle: Depends on abstractions (interfaces)
export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService
  ) {}

  /** Strip what must never leave the auth layer: the hash and the security metadata */
  private toSessionUser(user: User): SessionUser {
    const { password: _, passwordChangedAt: _changedAt, ...sessionUser } = user;
    return sessionUser;
  }

  /**
   * Check if email should be auto-promoted to admin based on ADMIN_EMAILS env var
   */
  private isAdminEmail(email: string): boolean {
    const adminEmails = process.env.ADMIN_EMAILS || '';
    const emailList = adminEmails.split(',').map((e) => e.trim().toLowerCase());
    return emailList.includes(email.toLowerCase());
  }

  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Validate password
    if (!this.passwordService.validate(data.password)) {
      throw new Error(
        'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(data.username)) {
      throw new Error(
        'Username must be 3-30 characters and contain only letters, numbers, and underscores'
      );
    }

    // Check if user already exists
    const exists = await this.userRepository.exists(data.email, data.username);
    if (exists) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const hashedPassword = await this.passwordService.hash(data.password);

    // Check if this email should be auto-promoted to admin
    const role: Role = this.isAdminEmail(data.email) ? 'ADMIN' : 'USER';

    // Create user with appropriate role
    const user = await this.userRepository.create({
      email: data.email,
      username: data.username,
      password: hashedPassword,
      fullName: data.fullName,
      role,
    });

    // Generate token with role
    const token = this.tokenService.generate({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Return user without password
    return {
      user: this.toSessionUser(user),
      token,
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user by email or username
    const isEmail = data.emailOrUsername.includes('@');
    const user = isEmail
      ? await this.userRepository.findByEmail(data.emailOrUsername)
      : await this.userRepository.findByUsername(data.emailOrUsername);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Check if user should be promoted to admin (in case they registered before being added to ADMIN_EMAILS)
    if (this.isAdminEmail(user.email) && user.role !== 'ADMIN') {
      console.warn(
        `[AUTH] Auto-promoting user ${user.id} (${user.email}) to ADMIN role based on ADMIN_EMAILS config`
      );
      await this.userRepository.updateRole(user.id, 'ADMIN');
      user.role = 'ADMIN';
    }

    // Generate token with role
    const token = this.tokenService.generate({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Return user without password
    return {
      user: this.toSessionUser(user),
      token,
    };
  }

  async validateToken(token: string): Promise<SessionUser | null> {
    const session = await this.resolveSession(token);
    return session ? this.toSessionUser(session.user) : null;
  }

  async validateSession(token: string): Promise<ValidatedSession | null> {
    const session = await this.resolveSession(token);
    if (!session) {
      return null;
    }

    const { user, payload } = session;

    // Sliding renewal: claims come from the database row, never from the old token,
    // so a role change reaches the JWT at the next renewal
    const renewedToken = this.isDueForRenewal(payload)
      ? this.tokenService.generate({
          userId: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        })
      : null;

    return { user: this.toSessionUser(user), renewedToken };
  }

  /** Every check a token must pass to stand for a user; shared by validateToken and validateSession */
  private async resolveSession(
    token: string
  ): Promise<{ user: User; payload: TokenPayload } | null> {
    const payload = this.tokenService.verify(token);
    if (!payload) {
      return null;
    }

    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      return null;
    }

    // Session invalidation: a password change or reset kills every older token
    if (this.isIssuedBeforePasswordChange(payload, user.passwordChangedAt)) {
      return null;
    }

    return { user, payload };
  }

  /** Renewing on every request would re-set the cookie each time; once per threshold is enough */
  private isDueForRenewal(payload: TokenPayload): boolean {
    // A token without iat is renewed so that it has one from then on
    const issuedAt = typeof payload.iat === 'number' ? payload.iat : 0;
    return Math.floor(Date.now() / 1000) - issuedAt >= getSessionRenewAfterSeconds();
  }

  /**
   * jwt `iat` is in SECONDS while passwordChangedAt has millisecond precision, so
   * the comparison is made in whole seconds: a token issued in the same second
   * as the change (the re-issued session, or a login right after a reset) stays valid.
   */
  private isIssuedBeforePasswordChange(
    payload: TokenPayload,
    passwordChangedAt: Date | null
  ): boolean {
    if (!passwordChangedAt) {
      return false;
    }

    // A token without iat cannot prove it is newer than the change
    if (typeof payload.iat !== 'number') {
      return true;
    }

    return payload.iat < Math.floor(passwordChangedAt.getTime() / 1000);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<string> {
    // Validate new password
    if (!this.passwordService.validate(newPassword)) {
      throw new Error(
        'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
      );
    }

    // Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await this.passwordService.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new Error('Invalid old password');
    }

    // Hash new password
    const hashedPassword = await this.passwordService.hash(newPassword);

    // Update password (also stamps passwordChangedAt, which invalidates every existing session)
    const updatedUser = await this.userRepository.updatePassword(userId, hashedPassword);

    // Fresh token for the session that made the change, issued after passwordChangedAt
    return this.tokenService.generate({
      userId: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
    });
  }
}
