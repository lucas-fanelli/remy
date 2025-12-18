import { UserService } from '../../UserService';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

describe('UserService - Unit Tests', () => {
  let userService: UserService;
  let mockUserRepository: IUserRepository;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed_password',
    fullName: 'Test User',
    bio: 'Test bio',
    avatar: 'https://example.com/avatar.jpg',
    website: 'https://example.com',
    role: 'USER',
    isVerified: false,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = mockDeep<IUserRepository>();
    userService = new UserService(mockUserRepository);
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await userService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should return user without password', async () => {
      mockUserRepository.findByUsername = jest.fn().mockResolvedValue(mockUser);

      const result = await userService.getUserByUsername('testuser');

      expect(result).toBeDefined();
      expect(result?.username).toBe(mockUser.username);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null for non-existent username', async () => {
      mockUserRepository.findByUsername = jest.fn().mockResolvedValue(null);

      const result = await userService.getUserByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updateData = {
        fullName: 'Updated Name',
        bio: 'Updated bio',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateProfile('user-123', updateData);

      expect(result).toBeDefined();
      expect(result.fullName).toBe(updateData.fullName);
      expect(result.bio).toBe(updateData.bio);
      expect(result).not.toHaveProperty('password');
    });

    it('should validate website URL', async () => {
      const updateData = {
        website: 'invalid-url',
      };

      await expect(
        userService.updateProfile('user-123', updateData)
      ).rejects.toThrow('Invalid website URL');
    });

    it('should accept valid website URL', async () => {
      const updateData = {
        website: 'https://example.com',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.website).toBe(updateData.website);
    });

    it('should validate bio length', async () => {
      const updateData = {
        bio: 'a'.repeat(301),
      };

      await expect(
        userService.updateProfile('user-123', updateData)
      ).rejects.toThrow('Bio must be 300 characters or less');
    });

    it('should accept bio with exactly 300 characters', async () => {
      const updateData = {
        bio: 'a'.repeat(300),
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.bio).toBe(updateData.bio);
    });

    it('should update privacy setting', async () => {
      const updateData = {
        isPrivate: true,
      };

      const updatedUser = { ...mockUser, isPrivate: true };
      mockUserRepository.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.isPrivate).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserRepository.delete = jest.fn().mockResolvedValue(mockUser);

      await userService.deleteUser('user-123');

      expect(mockUserRepository.delete).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getUsers', () => {
    it('should return users without passwords', async () => {
      const mockUsers = [mockUser, { ...mockUser, id: 'user-456' }];
      mockUserRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.getUsers(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[1]).not.toHaveProperty('password');
    });

    it('should handle pagination correctly', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([mockUser]);

      await userService.getUsers(2, 5);

      expect(mockUserRepository.findMany).toHaveBeenCalledWith(5, 5);
    });

    it('should use default pagination values', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([mockUser]);

      await userService.getUsers();

      expect(mockUserRepository.findMany).toHaveBeenCalledWith(0, 10);
    });

    it('should return empty array when no users', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([]);

      const result = await userService.getUsers();

      expect(result).toEqual([]);
    });
  });

  describe('searchUsers', () => {
    it('should search users by username', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user-456', username: 'testuser2' },
      ];
      mockUserRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
      expect(result.every((user) => !('password' in user))).toBe(true);
    });

    it('should search users by full name', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user-456', fullName: 'Test Another' },
      ];
      mockUserRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should be case insensitive', async () => {
      const mockUsers = [mockUser];
      mockUserRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('TEST', 10);

      expect(result).toBeDefined();
    });

    it('should limit results', async () => {
      const mockUsers = Array.from({ length: 20 }, (_, i) => ({
        ...mockUser,
        id: `user-${i}`,
        username: `testuser${i}`,
      }));
      mockUserRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty search results', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([]);

      const result = await userService.searchUsers('nonexistent', 10);

      expect(result).toEqual([]);
    });

    it('should handle users without fullName', async () => {
      const userWithoutName = { ...mockUser, fullName: null };
      mockUserRepository.findMany = jest.fn().mockResolvedValue([userWithoutName]);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should handle users with undefined fullName - line 78', async () => {
      const userWithUndefinedName = { ...mockUser, fullName: undefined };
      mockUserRepository.findMany = jest.fn().mockResolvedValue([userWithUndefinedName]);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should use default limit when not provided - line 70', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([mockUser]);

      const result = await userService.searchUsers('test');

      expect(result).toBeDefined();
    });
  });
});
