import { RateLimitService } from '../../RateLimitService';
import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { SubscriptionTier } from '@/domain/types/subscription';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let mockUserRepository: DeepMockProxy<IUserRepository>;

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
    mockUserRepository = mockDeep<IUserRepository>();
    rateLimitService = new RateLimitService(mockPrisma, mockUserRepository);
  });

  describe('checkLimit', () => {
    const userId = 'test-user-123';

    it('should allow FREE tier user with no usage', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(0);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3); // FREE tier: 3 per day
      expect(result.tier).toBe(SubscriptionTier.FREE);
    });

    it('should block FREE tier user after 3 daily requests', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(3);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('Daily limit');
    });

    it('should allow BASIC tier user 10 requests per day', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'basic',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(5);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5 = 5
      expect(result.tier).toBe(SubscriptionTier.BASIC);
    });

    it('should allow PRO tier user 50 requests per day', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'pro',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(25);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(25); // 50 - 25 = 25
      expect(result.tier).toBe(SubscriptionTier.PRO);
    });

    it('should allow CHEF tier unlimited requests', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'chef',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1); // Unlimited
      expect(result.tier).toBe(SubscriptionTier.CHEF);
    });

    it('should block user when monthly limit is exceeded', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First call for daily (within limit)
      (mockPrisma.aIUsageLog.count as jest.Mock)
        .mockResolvedValueOnce(2) // Daily: 2/3
        .mockResolvedValueOnce(30); // Monthly: 30/30

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly limit');
    });

    it('should use more restrictive limit (daily vs monthly)', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock)
        .mockResolvedValueOnce(1) // Daily: 1/3 (2 remaining)
        .mockResolvedValueOnce(29); // Monthly: 29/30 (1 remaining)

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // Min of 2 and 1
    });

    it('should block user with expired subscription', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: yesterday,
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should allow user with valid subscription expiry', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: tomorrow,
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(0);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.allowed).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        rateLimitService.checkLimit(userId, 'generate_recipe')
      ).rejects.toThrow('User not found');
    });

    it('should return correct reset time', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(0);

      const result = await rateLimitService.checkLimit(userId, 'generate_recipe');

      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('recordUsage', () => {
    const userId = 'test-user-123';

    it('should record successful usage', async () => {
      await rateLimitService.recordUsage(
        userId,
        'generate_recipe',
        'gemini',
        'gemini-1.5-pro',
        true
      );

      expect(mockPrisma.aIUsageLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'generate_recipe',
          provider: 'gemini',
          model: 'gemini-1.5-pro',
          success: true,
          errorMessage: undefined,
          tokensUsed: 0,
        },
      });
    });

    it('should record failed usage with error message', async () => {
      await rateLimitService.recordUsage(
        userId,
        'generate_recipe',
        'gemini',
        'gemini-1.5-pro',
        false,
        'API rate limit exceeded'
      );

      expect(mockPrisma.aIUsageLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'generate_recipe',
          provider: 'gemini',
          model: 'gemini-1.5-pro',
          success: false,
          errorMessage: 'API rate limit exceeded',
          tokensUsed: 0,
        },
      });
    });
  });

  describe('getRemainingQuota', () => {
    const userId = 'test-user-123';

    it('should return remaining quota', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(1);

      const remaining = await rateLimitService.getRemainingQuota(userId, 'generate_recipe');

      expect(remaining).toBe(2); // 3 - 1 = 2
    });

    it('should return 0 when limit exceeded', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'free',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(10);

      const remaining = await rateLimitService.getRemainingQuota(userId, 'generate_recipe');

      expect(remaining).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    const userId = 'test-user-123';

    it('should return daily usage statistics', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'basic',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(5);

      const stats = await rateLimitService.getUsageStats(userId, 'generate_recipe', 'day');

      expect(stats.used).toBe(5);
      expect(stats.limit).toBe(10); // BASIC tier daily limit
      expect(stats.resetAt).toBeInstanceOf(Date);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        rateLimitService.getUsageStats(userId, 'generate_recipe', 'day')
      ).rejects.toThrow('User not found');
    });

    it('should return monthly usage statistics', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'pro',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(500);

      const stats = await rateLimitService.getUsageStats(userId, 'generate_recipe', 'month');

      expect(stats.used).toBe(500);
      expect(stats.limit).toBe(1000); // PRO tier monthly limit
      expect(stats.resetAt).toBeInstanceOf(Date);
    });

    it('should return unlimited for CHEF tier', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed',
        subscriptionTier: 'chef',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.aIUsageLog.count as jest.Mock).mockResolvedValue(5000);

      const stats = await rateLimitService.getUsageStats(userId, 'generate_recipe', 'day');

      expect(stats.used).toBe(5000);
      expect(stats.limit).toBe(-1); // Unlimited
    });
  });
});
