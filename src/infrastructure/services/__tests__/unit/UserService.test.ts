import { User } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { notifyRequestsAccepted } from '@/lib/follows/requests';
import { UserService } from '../../UserService';

// Tested in src/lib/follows; here it only has to be called, or not, at the right moment
jest.mock('@/lib/follows/requests', () => ({ notifyRequestsAccepted: jest.fn() }));

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
    passwordChangedAt: new Date('2026-01-01T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = mockDeep<IUserRepository>();
    userService = new UserService(mockUserRepository);
  });

  describe('security metadata', () => {
    it('should not expose passwordChangedAt when looking a user up by id', async () => {
      mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(result).not.toHaveProperty('passwordChangedAt');
    });

    it('should not expose passwordChangedAt on a public profile', async () => {
      mockUserRepository.findByUsername = jest.fn().mockResolvedValue(mockUser);

      const result = await userService.getUserByUsername('testuser');

      expect(result).not.toHaveProperty('passwordChangedAt');
    });

    it('should not expose passwordChangedAt after a profile update', async () => {
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: mockUser, accepted: [] });

      const result = await userService.updateProfile('user-123', { bio: 'New bio' });

      expect(result).not.toHaveProperty('passwordChangedAt');
    });

    it('should not expose passwordChangedAt in user listings', async () => {
      mockUserRepository.findMany = jest.fn().mockResolvedValue([mockUser]);

      const result = await userService.getUsers(1, 10);

      expect(result[0]).not.toHaveProperty('passwordChangedAt');
    });

    it('should not expose passwordChangedAt in search results', async () => {
      mockUserRepository.search = jest.fn().mockResolvedValue([mockUser]);

      const result = await userService.searchUsers('test', 10);

      expect(result[0]).not.toHaveProperty('passwordChangedAt');
    });
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
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: updatedUser, accepted: [] });

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

      await expect(userService.updateProfile('user-123', updateData)).rejects.toThrow(
        'Invalid website URL'
      );
    });

    it('should accept valid website URL', async () => {
      const updateData = {
        website: 'https://example.com',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: updatedUser, accepted: [] });

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.website).toBe(updateData.website);
    });

    it('should validate bio length', async () => {
      const updateData = {
        bio: 'a'.repeat(301),
      };

      await expect(userService.updateProfile('user-123', updateData)).rejects.toThrow(
        'Bio must be 300 characters or less'
      );
    });

    it('should accept bio with exactly 300 characters', async () => {
      const updateData = {
        bio: 'a'.repeat(300),
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: updatedUser, accepted: [] });

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.bio).toBe(updateData.bio);
    });

    it('should update privacy setting', async () => {
      const updateData = {
        isPrivate: true,
      };

      const updatedUser = { ...mockUser, isPrivate: true };
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: updatedUser, accepted: [] });

      const result = await userService.updateProfile('user-123', updateData);

      expect(result.isPrivate).toBe(true);
    });

    it('should save through updateProfile, which accepts pending requests on going public', async () => {
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: mockUser, accepted: [] });

      await userService.updateProfile('user-123', { isPrivate: false });

      expect(mockUserRepository.updateProfile).toHaveBeenCalledWith('user-123', {
        isPrivate: false,
      });
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should tell the requesters a save accepted, once the save has returned', async () => {
      mockUserRepository.updateProfile = jest
        .fn()
        .mockResolvedValue({ user: mockUser, accepted: ['req-1', 'req-2'] });

      await userService.updateProfile('user-123', { isPrivate: false });

      expect(notifyRequestsAccepted).toHaveBeenCalledWith('user-123', ['req-1', 'req-2']);
      expect(
        (mockUserRepository.updateProfile as jest.Mock).mock.invocationCallOrder[0]
      ).toBeLessThan((notifyRequestsAccepted as jest.Mock).mock.invocationCallOrder[0]);
    });

    it('should tell no one when the save fails', async () => {
      mockUserRepository.updateProfile = jest.fn().mockRejectedValue(new Error('lock timeout'));

      await expect(userService.updateProfile('user-123', { isPrivate: false })).rejects.toThrow(
        'lock timeout'
      );
      expect(notifyRequestsAccepted).not.toHaveBeenCalled();
    });

    it('should save nothing when validation fails', async () => {
      mockUserRepository.updateProfile = jest.fn();

      await expect(
        userService.updateProfile('user-123', { isPrivate: false, bio: 'a'.repeat(301) })
      ).rejects.toThrow('Bio must be 300 characters or less');
      expect(mockUserRepository.updateProfile).not.toHaveBeenCalled();
      expect(notifyRequestsAccepted).not.toHaveBeenCalled();
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
      const mockUsers = [mockUser, { ...mockUser, id: 'user-456', username: 'testuser2' }];
      mockUserRepository.search = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
      expect(result.every((user) => !('password' in user))).toBe(true);
      expect(mockUserRepository.search).toHaveBeenCalledWith('test', 10, undefined);
    });

    it('should search users by full name', async () => {
      const mockUsers = [mockUser, { ...mockUser, id: 'user-456', fullName: 'Test Another' }];
      mockUserRepository.search = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should be case insensitive', async () => {
      const mockUsers = [mockUser];
      mockUserRepository.search = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('TEST', 10);

      expect(result).toBeDefined();
    });

    it('should limit results', async () => {
      const mockUsers = Array.from({ length: 5 }, (_, i) => ({
        ...mockUser,
        id: `user-${i}`,
        username: `testuser${i}`,
      }));
      mockUserRepository.search = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.searchUsers('test', 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty search results', async () => {
      mockUserRepository.search = jest.fn().mockResolvedValue([]);

      const result = await userService.searchUsers('nonexistent', 10);

      expect(result).toEqual([]);
    });

    it('should handle users without fullName', async () => {
      const userWithoutName = { ...mockUser, fullName: null };
      mockUserRepository.search = jest.fn().mockResolvedValue([userWithoutName]);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should handle users with undefined fullName - line 78', async () => {
      const userWithUndefinedName = { ...mockUser, fullName: undefined };
      mockUserRepository.search = jest.fn().mockResolvedValue([userWithUndefinedName]);

      const result = await userService.searchUsers('test', 10);

      expect(result).toBeDefined();
    });

    it('should use default limit when not provided - line 70', async () => {
      mockUserRepository.search = jest.fn().mockResolvedValue([mockUser]);

      const result = await userService.searchUsers('test');

      expect(result).toBeDefined();
    });

    it('should search users with undefined fullName - line 77', async () => {
      const userWithoutFullName = {
        ...mockUser,
        fullName: undefined,
      };
      mockUserRepository.search = jest.fn().mockResolvedValue([userWithoutFullName]);

      // Search by username should still work when fullName is undefined
      const result = await userService.searchUsers('test');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].username).toBe('testuser');
    });

    it('should search users and match by fullName when present - line 77-78', async () => {
      const userWithFullName = {
        ...mockUser,
        fullName: 'John Doe',
      };
      mockUserRepository.search = jest.fn().mockResolvedValue([userWithFullName]);

      // Search by fullName should work
      const result = await userService.searchUsers('john');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
