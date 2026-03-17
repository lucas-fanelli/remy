import { User, Role } from '@prisma/client';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IAuthService, RegisterDTO, LoginDTO, AuthResponse } from '@/domain/services/IAuthService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { ITokenService } from '@/domain/services/ITokenService';

// Single Responsibility Principle: Only handles authentication logic
// Dependency Inversion Principle: Depends on abstractions (interfaces)
export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService
  ) {}

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
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
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
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  async validateToken(token: string): Promise<Omit<User, 'password'> | null> {
    const payload = this.tokenService.verify(token);
    if (!payload) {
      return null;
    }

    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
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

    // Update password
    await this.userRepository.updatePassword(userId, hashedPassword);
  }
}
