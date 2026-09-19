import { User } from '@prisma/client';
import { mock, mockDeep } from 'jest-mock-extended';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { ITokenService } from '@/domain/services/ITokenService';
import { AuthService } from '../../AuthService';

describe('AuthService - Unit Tests', () => {
  let authService: AuthService;
  let mockUserRepository: IUserRepository;
  let mockPasswordService: IPasswordService;
  let mockTokenService: ITokenService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed_password',
    fullName: 'Test User',
    bio: null,
    avatar: null,
    website: null,
    role: 'USER',
    isVerified: false,
    isPrivate: false,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = mockDeep<IUserRepository>();
    mockPasswordService = mockDeep<IPasswordService>();
    mockTokenService = mockDeep<ITokenService>();

    authService = new AuthService(mockUserRepository, mockPasswordService, mockTokenService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
        fullName: 'Test User',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.exists = jest.fn().mockResolvedValue(false);
      mockPasswordService.hash = jest.fn().mockResolvedValue('hashed_password');
      mockUserRepository.create = jest.fn().mockResolvedValue(mockUser);
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.register(registerData);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerData.email);
      expect(result.user.username).toBe(registerData.username);
      expect(result.token).toBe('jwt_token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw error for invalid password', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'weak',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(false);

      await expect(authService.register(registerData)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should throw error for invalid email format', async () => {
      const registerData = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test1234',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);

      await expect(authService.register(registerData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for invalid username format', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'te',
        password: 'Test1234',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);

      await expect(authService.register(registerData)).rejects.toThrow(
        'Username must be 3-30 characters'
      );
    });

    it('should throw error for username with special characters', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'test@user',
        password: 'Test1234',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);

      await expect(authService.register(registerData)).rejects.toThrow(
        'Username must be 3-30 characters'
      );
    });

    it('should throw error if user already exists', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.exists = jest.fn().mockResolvedValue(true);

      await expect(authService.register(registerData)).rejects.toThrow(
        'User with this email or username already exists'
      );
    });
  });

  describe('login', () => {
    it('should login user with email successfully', async () => {
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'Test1234',
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.login(loginData);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
      expect(result.token).toBe('jwt_token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should login user with username successfully', async () => {
      const loginData = {
        emailOrUsername: 'testuser',
        password: 'Test1234',
      };

      mockUserRepository.findByUsername = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.login(loginData);

      expect(result).toBeDefined();
      expect(result.user.username).toBe(mockUser.username);
    });

    it('should throw error for non-existent user', async () => {
      const loginData = {
        emailOrUsername: 'nonexistent@example.com',
        password: 'Test1234',
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'WrongPassword123',
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should promote user to admin if email is in ADMIN_EMAILS', async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'admin@example.com,test@example.com';

      const userNotAdmin = { ...mockUser, role: 'USER' };
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'Test1234',
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(userNotAdmin);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockUserRepository.updateRole = jest
        .fn()
        .mockResolvedValue({ ...userNotAdmin, role: 'ADMIN' });
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.login(loginData);

      expect(mockUserRepository.updateRole).toHaveBeenCalledWith(userNotAdmin.id, 'ADMIN');
      expect(result.user.role).toBe('ADMIN');

      process.env.ADMIN_EMAILS = originalEnv;
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user', async () => {
      const token = 'valid_jwt_token';
      const payload = {
        userId: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      };

      mockTokenService.verify = jest.fn().mockReturnValue(payload);
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.validateToken(token);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid_token';

      mockTokenService.verify = jest.fn().mockReturnValue(null);

      const result = await authService.validateToken(token);

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      const token = 'valid_jwt_token';
      const payload = {
        userId: 'non-existent-user',
        email: 'test@example.com',
        username: 'testuser',
      };

      mockTokenService.verify = jest.fn().mockReturnValue(payload);
      mockUserRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await authService.validateToken(token);

      expect(result).toBeNull();
    });
  });

  describe('validateToken - session invalidation after a password change', () => {
    // jwt iat is in SECONDS; passwordChangedAt has millisecond precision
    const changedAt = new Date('2026-01-01T10:00:00.900Z');
    const changedAtSeconds = Math.floor(changedAt.getTime() / 1000);

    const arrange = (iat: number | undefined, passwordChangedAt: Date | null) => {
      mockTokenService.verify = jest.fn().mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        role: 'USER',
        iat,
      });
      mockUserRepository.findById = jest.fn().mockResolvedValue({ ...mockUser, passwordChangedAt });
    };

    it('should accept any token when the password was never changed', async () => {
      // Arrange
      arrange(1, null);

      // Act
      const result = await authService.validateToken('token');

      // Assert
      expect(result?.id).toBe(mockUser.id);
    });

    it('should reject a token issued the second before the password changed', async () => {
      // Arrange
      arrange(changedAtSeconds - 1, changedAt);

      // Act
      const result = await authService.validateToken('token');

      // Assert
      expect(result).toBeNull();
    });

    it('should accept a token issued in the same second as the password change', async () => {
      // Arrange - iat (…:00) is numerically before changedAt (…:00.900) in milliseconds,
      // but the comparison is made in whole seconds
      arrange(changedAtSeconds, changedAt);

      // Act
      const result = await authService.validateToken('token');

      // Assert
      expect(result?.id).toBe(mockUser.id);
    });

    it('should accept a token issued after the password changed', async () => {
      // Arrange
      arrange(changedAtSeconds + 60, changedAt);

      // Act
      const result = await authService.validateToken('token');

      // Assert
      expect(result?.id).toBe(mockUser.id);
    });

    it('should reject a token without iat once the password has been changed', async () => {
      // Arrange
      arrange(undefined, changedAt);

      // Act
      const result = await authService.validateToken('token');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('passwordChangedAt stays inside the auth layer', () => {
    // These objects are what /api/auth/me, login and register send to the browser
    const changedAt = new Date('2026-01-01T10:00:00.000Z');
    const changedUser = { ...mockUser, passwordChangedAt: changedAt };

    it('should not return passwordChangedAt from validateToken', async () => {
      mockTokenService.verify = jest.fn().mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        role: 'USER',
        iat: Math.floor(changedAt.getTime() / 1000) + 60,
      });
      mockUserRepository.findById = jest.fn().mockResolvedValue(changedUser);

      const result = await authService.validateToken('token');

      expect(result?.id).toBe(mockUser.id);
      expect(result).not.toHaveProperty('passwordChangedAt');
      expect(result).not.toHaveProperty('password');
    });

    it('should not return passwordChangedAt from login', async () => {
      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(changedUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockTokenService.generate = jest.fn().mockReturnValue('jwt');

      const result = await authService.login({
        emailOrUsername: mockUser.email,
        password: 'Password123',
      });

      expect(result.user).not.toHaveProperty('passwordChangedAt');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should not return passwordChangedAt from register', async () => {
      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockPasswordService.hash = jest.fn().mockResolvedValue('hashed');
      mockUserRepository.exists = jest.fn().mockResolvedValue(false);
      mockUserRepository.create = jest.fn().mockResolvedValue(changedUser);
      mockTokenService.generate = jest.fn().mockReturnValue('jwt');

      const result = await authService.register({
        email: mockUser.email,
        username: mockUser.username,
        password: 'Password123',
      });

      expect(result.user).not.toHaveProperty('passwordChangedAt');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'user-123';
      const oldPassword = 'OldPassword123';
      const newPassword = 'NewPassword123';

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockPasswordService.hash = jest.fn().mockResolvedValue('new_hashed_password');
      mockUserRepository.updatePassword = jest.fn().mockResolvedValue(mockUser);

      await authService.changePassword(userId, oldPassword, newPassword);

      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, 'new_hashed_password');
    });

    it('should return a fresh session token for the user who changed the password', async () => {
      // Arrange
      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockPasswordService.hash = jest.fn().mockResolvedValue('new_hashed_password');
      mockUserRepository.updatePassword = jest.fn().mockResolvedValue(mockUser);
      mockTokenService.generate = jest.fn().mockReturnValue('fresh_jwt_token');

      // Act
      const token = await authService.changePassword(
        'user-123',
        'OldPassword123',
        'NewPassword123'
      );

      // Assert
      expect(token).toBe('fresh_jwt_token');
      expect(mockTokenService.generate).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
      });
    });

    it('should issue the fresh token only after the password was stored', async () => {
      // Arrange
      const calls: string[] = [];
      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(true);
      mockPasswordService.hash = jest.fn().mockResolvedValue('new_hashed_password');
      mockUserRepository.updatePassword = jest.fn().mockImplementation(async () => {
        calls.push('updatePassword');
        return mockUser;
      });
      mockTokenService.generate = jest.fn().mockImplementation(() => {
        calls.push('generate');
        return 'fresh_jwt_token';
      });

      // Act
      await authService.changePassword('user-123', 'OldPassword123', 'NewPassword123');

      // Assert - a token signed before passwordChangedAt would be rejected on the next request
      expect(calls).toEqual(['updatePassword', 'generate']);
    });

    it('should throw error for invalid new password', async () => {
      const userId = 'user-123';
      const oldPassword = 'OldPassword123';
      const newPassword = 'weak';

      mockPasswordService.validate = jest.fn().mockReturnValue(false);

      await expect(authService.changePassword(userId, oldPassword, newPassword)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent';
      const oldPassword = 'OldPassword123';
      const newPassword = 'NewPassword123';

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(authService.changePassword(userId, oldPassword, newPassword)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error for incorrect old password', async () => {
      const userId = 'user-123';
      const oldPassword = 'WrongOldPassword123';
      const newPassword = 'NewPassword123';

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);
      mockPasswordService.compare = jest.fn().mockResolvedValue(false);

      await expect(authService.changePassword(userId, oldPassword, newPassword)).rejects.toThrow(
        'Invalid old password'
      );
    });
  });

  describe('ADMIN_EMAILS edge cases - lines 25, 60', () => {
    it('should fallback to empty string when ADMIN_EMAILS is undefined - line 25', async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      delete process.env.ADMIN_EMAILS;

      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test1234',
        fullName: 'Test User',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.exists = jest.fn().mockResolvedValue(false);
      mockPasswordService.hash = jest.fn().mockResolvedValue('hashed_password');
      mockUserRepository.create = jest.fn().mockResolvedValue({ ...mockUser, role: 'USER' });
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.register(registerData);

      // Should default to USER role when ADMIN_EMAILS is not set
      expect(result.user.role).toBe('USER');

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it('should register as USER when email is not in ADMIN_EMAILS - line 60', async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'admin@example.com';

      const registerData = {
        email: 'notadmin@example.com',
        username: 'notadmin',
        password: 'Test1234',
        fullName: 'Not Admin',
      };

      mockPasswordService.validate = jest.fn().mockReturnValue(true);
      mockUserRepository.exists = jest.fn().mockResolvedValue(false);
      mockPasswordService.hash = jest.fn().mockResolvedValue('hashed_password');
      mockUserRepository.create = jest
        .fn()
        .mockResolvedValue({ ...mockUser, email: 'notadmin@example.com', role: 'USER' });
      mockTokenService.generate = jest.fn().mockReturnValue('jwt_token');

      const result = await authService.register(registerData);

      expect(result.user.role).toBe('USER');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'USER',
        })
      );

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it('should register with ADMIN role when email is in ADMIN_EMAILS - line 60', async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'admin@test.com';

      const registerData = {
        email: 'admin@test.com',
        username: 'adminuser',
        password: 'AdminPass123!',
        fullName: 'Admin User',
      };

      mockPasswordService.validate.mockReturnValue(true);
      mockPasswordService.hash.mockResolvedValue('hashed_password');
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'new-admin',
        email: 'admin@test.com',
        username: 'adminuser',
        fullName: 'Admin User',
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTokenService.generate.mockReturnValue('test-token');

      await authService.register(registerData);

      // Verify user was created with ADMIN role
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        })
      );

      process.env.ADMIN_EMAILS = originalEnv;
    });
  });
});
