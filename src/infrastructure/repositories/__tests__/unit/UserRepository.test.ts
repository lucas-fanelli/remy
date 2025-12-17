import { UserRepository } from '../../UserRepository';
import { PrismaClient, User } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('UserRepository - Unit Tests', () => {
  let userRepository: UserRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    userRepository = new UserRepository(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed_password',
        fullName: 'Test User',
      };

      prismaMock.user.create.mockResolvedValue(mockUser);

      const result = await userRepository.create(createData);

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });

    it('should create user without optional fullName', async () => {
      const createData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed_password',
      };

      const userWithoutName = { ...mockUser, fullName: null };
      prismaMock.user.create.mockResolvedValue(userWithoutName);

      const result = await userRepository.create(createData);

      expect(result.fullName).toBeNull();
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if email not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should be case sensitive', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'TEST@EXAMPLE.COM' },
      });
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should return null if username not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should find many users with default pagination', async () => {
      const mockUsers = [mockUser, { ...mockUser, id: 'user-456' }];
      prismaMock.user.findMany.mockResolvedValue(mockUsers);

      const result = await userRepository.findMany();

      expect(result).toEqual(mockUsers);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should find many users with custom pagination', async () => {
      const mockUsers = [mockUser];
      prismaMock.user.findMany.mockResolvedValue(mockUsers);

      const result = await userRepository.findMany(20, 5);

      expect(result).toEqual(mockUsers);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when no users found', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await userRepository.findMany();

      expect(result).toEqual([]);
    });

    it('should order by createdAt descending', async () => {
      prismaMock.user.findMany.mockResolvedValue([mockUser]);

      await userRepository.findMany(0, 10);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updateData = {
        fullName: 'Updated Name',
        bio: 'Updated bio',
      };

      const updatedUser = { ...mockUser, ...updateData };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.update('user-123', updateData);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
    });

    it('should update single field', async () => {
      const updateData = { bio: 'New bio' };
      const updatedUser = { ...mockUser, bio: 'New bio' };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.update('user-123', updateData);

      expect(result.bio).toBe('New bio');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
    });

    it('should update privacy setting', async () => {
      const updateData = { isPrivate: true };
      const updatedUser = { ...mockUser, isPrivate: true };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.update('user-123', updateData);

      expect(result.isPrivate).toBe(true);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const newHashedPassword = 'new_hashed_password';
      const updatedUser = { ...mockUser, password: newHashedPassword };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.updatePassword('user-123', newHashedPassword);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          password: newHashedPassword,
        },
      });
    });

    it('should only update password field', async () => {
      const newHashedPassword = 'new_hashed_password';
      const updatedUser = { ...mockUser, password: newHashedPassword };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      await userRepository.updatePassword('user-123', newHashedPassword);

      const callData = prismaMock.user.update.mock.calls[0][0].data;
      expect(Object.keys(callData)).toEqual(['password']);
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      prismaMock.user.delete.mockResolvedValue(mockUser);

      const result = await userRepository.delete('user-123');

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return deleted user data', async () => {
      prismaMock.user.delete.mockResolvedValue(mockUser);

      const result = await userRepository.delete('user-123');

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('exists', () => {
    it('should return true if user exists by email', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      const result = await userRepository.exists('test@example.com', 'otheruser');

      expect(result).toBe(true);
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'test@example.com' },
            { username: 'otheruser' },
          ],
        },
      });
    });

    it('should return true if user exists by username', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      const result = await userRepository.exists('other@example.com', 'testuser');

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const result = await userRepository.exists('new@example.com', 'newuser');

      expect(result).toBe(false);
    });

    it('should check both email and username with OR condition', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await userRepository.exists('test@example.com', 'testuser');

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'test@example.com' },
            { username: 'testuser' },
          ],
        },
      });
    });
  });

  describe('count', () => {
    it('should return total count of users', async () => {
      prismaMock.user.count.mockResolvedValue(42);

      const result = await userRepository.count();

      expect(result).toBe(42);
      expect(prismaMock.user.count).toHaveBeenCalled();
    });

    it('should return 0 when no users exist', async () => {
      prismaMock.user.count.mockResolvedValue(0);

      const result = await userRepository.count();

      expect(result).toBe(0);
    });

    it('should return correct count for large numbers', async () => {
      prismaMock.user.count.mockResolvedValue(10000);

      const result = await userRepository.count();

      expect(result).toBe(10000);
    });
  });
});
