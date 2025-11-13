import { AIRecipeService } from '../../AIRecipeService';
import { AIProviderFactory } from '@/infrastructure/ai/AIProviderFactory';
import { IAIRecipeProvider } from '@/domain/types/ai-provider';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IRateLimitService } from '@/domain/services/IRateLimitService';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SubscriptionTier } from '@/domain/types/subscription';

describe('AIRecipeService', () => {
  let service: AIRecipeService;
  let mockProviderFactory: DeepMockProxy<AIProviderFactory>;
  let mockRateLimitService: DeepMockProxy<IRateLimitService>;
  let mockRecipeRepository: DeepMockProxy<IRecipeRepository>;
  let mockUserRepository: DeepMockProxy<IUserRepository>;
  let mockAIProvider: DeepMockProxy<IAIRecipeProvider>;

  const userId = 'test-user-123';

  beforeEach(() => {
    mockProviderFactory = mockDeep<AIProviderFactory>();
    mockRateLimitService = mockDeep<IRateLimitService>();
    mockRecipeRepository = mockDeep<IRecipeRepository>();
    mockUserRepository = mockDeep<IUserRepository>();
    mockAIProvider = mockDeep<IAIRecipeProvider>();

    mockAIProvider.name = 'gemini';
    mockAIProvider.model = 'gemini-1.5-pro';
    mockAIProvider.isConfigured.mockReturnValue(true);

    service = new AIRecipeService(
      mockProviderFactory as any,
      mockRateLimitService,
      mockRecipeRepository,
      mockUserRepository
    );
  });

  describe('generateRecipe', () => {
    const ingredients = ['chicken', 'tomato', 'pasta'];

    beforeEach(() => {
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
    });

    it('should generate recipe using default provider (gemini)', async () => {
      const mockRecipe = {
        id: '1',
        title: 'Chicken Pasta',
        description: 'Delicious pasta',
        imageUrl: '',
        userId,
        cookingTime: 30,
        prepTime: 15,
        servings: 4,
        difficulty: 'medium' as const,
        cuisine: 'Italian',
        ingredients: [
          { name: 'chicken', amount: '500', unit: 'g' },
          { name: 'tomato', amount: '3', unit: 'pieces' },
          { name: 'pasta', amount: '400', unit: 'g' },
        ],
        instructions: [
          { step: 1, description: 'Cook pasta' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAIProvider.generateRecipe.mockResolvedValue({
        recipe: mockRecipe,
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        tokensUsed: 500,
        success: true,
      });

      mockProviderFactory.getProvider.mockReturnValue(mockAIProvider as any);
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      mockRecipeRepository.create.mockResolvedValue(mockRecipe);

      const result = await service.generateRecipe(userId, ingredients);

      expect(result).toEqual(mockRecipe);
      expect(mockRateLimitService.recordUsage).toHaveBeenCalledWith(
        userId,
        'generate_recipe',
        'gemini',
        'gemini-1.5-pro',
        true
      );
    });

    it('should throw error when rate limit exceeded', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 3,
        tier: SubscriptionTier.FREE,
        resetAt: new Date(),
        reason: 'Daily limit exceeded',
      });

      await expect(
        service.generateRecipe(userId, ingredients)
      ).rejects.toThrow('Daily limit exceeded');
    });

    it('should throw error when provider not available for tier', async () => {
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

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 3,
        limit: 3,
        tier: SubscriptionTier.FREE,
        resetAt: new Date(),
      });

      await expect(
        service.generateRecipe(userId, ingredients, undefined, 'claude')
      ).rejects.toThrow('Your free subscription does not have access to claude');
    });

    it('should throw error when user not found', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.generateRecipe(userId, ingredients)
      ).rejects.toThrow('User not found');
    });

    it('should record failed usage on error', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      mockAIProvider.generateRecipe.mockRejectedValue(new Error('API error'));
      mockProviderFactory.getProvider.mockReturnValue(mockAIProvider as any);

      await expect(
        service.generateRecipe(userId, ingredients)
      ).rejects.toThrow('API error');

      expect(mockRateLimitService.recordUsage).toHaveBeenCalledWith(
        userId,
        'generate_recipe',
        'gemini',
        'gemini-1.5-pro',
        false,
        'API error'
      );
    });
  });

  describe('suggestSubstitutions', () => {
    it('should suggest ingredient substitutions', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      const substitutions = ['Greek yogurt', 'buttermilk', 'coconut milk'];
      mockAIProvider.suggestSubstitutions.mockResolvedValue(substitutions);
      mockProviderFactory.getDefaultProvider.mockReturnValue(mockAIProvider as any);

      const result = await service.suggestSubstitutions(userId, 'milk', 'baking');

      expect(result).toEqual(substitutions);
      expect(mockAIProvider.suggestSubstitutions).toHaveBeenCalledWith('milk', 'baking');
      expect(mockRateLimitService.recordUsage).toHaveBeenCalledWith(
        userId,
        'substitution',
        'gemini',
        'gemini-1.5-pro',
        true
      );
    });

    it('should throw error when rate limit exceeded', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 3,
        tier: SubscriptionTier.FREE,
        resetAt: new Date(),
      });

      await expect(
        service.suggestSubstitutions(userId, 'milk', 'baking')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should record failed usage on error', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      mockAIProvider.suggestSubstitutions.mockRejectedValue(new Error('API error'));
      mockProviderFactory.getDefaultProvider.mockReturnValue(mockAIProvider as any);

      await expect(
        service.suggestSubstitutions(userId, 'milk', 'baking')
      ).rejects.toThrow('API error');

      expect(mockRateLimitService.recordUsage).toHaveBeenCalledWith(
        userId,
        'substitution',
        'gemini',
        'gemini-1.5-pro',
        false,
        'API error'
      );
    });
  });

  describe('getCookingAdvice', () => {
    it('should get cooking advice without recipe context', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      const advice = 'Cook over medium heat for best results.';
      mockAIProvider.getCookingAdvice.mockResolvedValue(advice);
      mockProviderFactory.getDefaultProvider.mockReturnValue(mockAIProvider as any);

      const result = await service.getCookingAdvice(userId, 'How do I sauté vegetables?');

      expect(result).toBe(advice);
      expect(mockAIProvider.getCookingAdvice).toHaveBeenCalledWith('How do I sauté vegetables?', undefined);
    });

    it('should get cooking advice with recipe context', async () => {
      const mockRecipe = {
        id: 'recipe-123',
        title: 'Chicken Pasta',
        description: 'Delicious pasta',
        imageUrl: '',
        userId,
        cookingTime: 30,
        prepTime: 15,
        servings: 4,
        difficulty: 'medium' as const,
        cuisine: 'Italian',
        ingredients: [{ name: 'chicken', amount: '500', unit: 'g' }],
        instructions: [
          { step: 1, description: 'Cook pasta' },
          { step: 2, description: 'Add sauce' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      });

      mockRecipeRepository.findById.mockResolvedValue(mockRecipe);

      const advice = 'For step 2, make sure the pasta is drained before adding sauce.';
      mockAIProvider.getCookingAdvice.mockResolvedValue(advice);
      mockProviderFactory.getDefaultProvider.mockReturnValue(mockAIProvider as any);

      const result = await service.getCookingAdvice(
        userId,
        'How do I do step 2?',
        { recipeId: 'recipe-123', step: 2 }
      );

      expect(result).toBe(advice);
      expect(mockAIProvider.getCookingAdvice).toHaveBeenCalledWith(
        'How do I do step 2?',
        expect.objectContaining({
          recipeTitle: 'Chicken Pasta',
          currentStep: 2,
        })
      );
    });

    it('should throw error when rate limit exceeded', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 3,
        tier: SubscriptionTier.FREE,
        resetAt: new Date(),
      });

      await expect(
        service.getCookingAdvice(userId, 'How do I cook rice?')
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('canUserGenerateRecipe', () => {
    it('should return rate limit result', async () => {
      const rateLimitResult = {
        allowed: true,
        remaining: 45,
        limit: 50,
        tier: SubscriptionTier.PRO,
        resetAt: new Date(),
      };

      mockRateLimitService.checkLimit.mockResolvedValue(rateLimitResult);

      const result = await service.canUserGenerateRecipe(userId);

      expect(result).toEqual(rateLimitResult);
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(userId, 'generate_recipe');
    });
  });

  describe('getRemainingQuota', () => {
    it('should return daily and monthly quota', async () => {
      mockRateLimitService.getUsageStats
        .mockResolvedValueOnce({
          used: 5,
          limit: 50,
          resetAt: new Date('2025-01-02'),
        })
        .mockResolvedValueOnce({
          used: 100,
          limit: 1000,
          resetAt: new Date('2025-02-01'),
        });

      const result = await service.getRemainingQuota(userId);

      expect(result).toEqual({
        daily: 45, // 50 - 5
        monthly: 900, // 1000 - 100
        resetAt: expect.any(Date),
      });
    });

    it('should handle unlimited tier correctly', async () => {
      mockRateLimitService.getUsageStats
        .mockResolvedValueOnce({
          used: 1000,
          limit: -1, // Unlimited
          resetAt: new Date(),
        })
        .mockResolvedValueOnce({
          used: 5000,
          limit: -1, // Unlimited
          resetAt: new Date(),
        });

      const result = await service.getRemainingQuota(userId);

      expect(result.daily).toBe(-1);
      expect(result.monthly).toBe(-1);
    });
  });
});
