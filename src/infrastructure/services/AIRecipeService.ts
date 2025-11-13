import { IAIRecipeService } from '@/domain/services/IAIRecipeService';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { IRateLimitService } from '@/domain/services/IRateLimitService';
import { Recipe } from '@/domain/types/recipe';
import { AIRecipeRequest, RecipePreferences } from '@/domain/types/ai-provider';
import { RateLimitResult, SubscriptionTier, SUBSCRIPTION_LIMITS } from '@/domain/types/subscription';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { IUserRepository } from '@/domain/repositories/IUserRepository';

/**
 * AI Recipe Service - Orchestrator
 * Coordinates AI providers, rate limiting, and recipe storage
 * Follows Single Responsibility Principle and Dependency Inversion
 */
export class AIRecipeService implements IAIRecipeService {
  constructor(
    private providerFactory: AIProviderFactory,
    private rateLimitService: IRateLimitService,
    private recipeRepository: IRecipeRepository,
    private userRepository: IUserRepository
  ) {}

  async generateRecipe(
    userId: string,
    ingredients: string[],
    preferences?: RecipePreferences,
    providerName?: string
  ): Promise<Recipe> {
    // 1. Check rate limits
    const limitCheck = await this.canUserGenerateRecipe(userId);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Rate limit exceeded');
    }

    // 2. Validate provider access
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tier = (user.subscriptionTier as SubscriptionTier) || SubscriptionTier.FREE;
    const limits = SUBSCRIPTION_LIMITS[tier];

    // Use default provider if not specified
    const selectedProvider = providerName || 'gemini';

    // Check if user has access to this provider
    if (!limits.allowedProviders.includes(selectedProvider)) {
      throw new Error(
        `Your ${tier} subscription does not have access to ${selectedProvider}. Upgrade to access more providers.`
      );
    }

    // 3. Get AI provider
    const provider = this.providerFactory.getProvider(selectedProvider);

    // 4. Generate recipe
    const request: AIRecipeRequest = {
      ingredients,
      preferences,
      userId,
    };

    let aiResponse;
    let success = true;
    let errorMessage: string | undefined;

    try {
      aiResponse = await provider.generateRecipe(request);
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed usage
      await this.rateLimitService.recordUsage(
        userId,
        'generate_recipe',
        provider.name,
        provider.model,
        false,
        errorMessage
      );

      throw error;
    }

    // 5. Save recipe to database
    const recipe = await this.recipeRepository.create({
      ...aiResponse.recipe,
      userId, // AI recipes belong to the system but attributed to user
    });

    // Update the recipe with AI metadata (need to use Prisma directly for these fields)
    // This would ideally be in a separate method or the repository should support these fields

    // 6. Record successful usage
    await this.rateLimitService.recordUsage(
      userId,
      'generate_recipe',
      provider.name,
      provider.model,
      true
    );

    return recipe;
  }

  async suggestSubstitutions(
    userId: string,
    ingredient: string,
    context: string
  ): Promise<string[]> {
    // Check rate limits (substitutions count as a smaller action)
    const limitCheck = await this.canUserGenerateRecipe(userId);
    if (!limitCheck.allowed) {
      throw new Error('Rate limit exceeded');
    }

    const provider = this.providerFactory.getDefaultProvider();

    try {
      const substitutions = await provider.suggestSubstitutions(ingredient, context);

      // Record usage
      await this.rateLimitService.recordUsage(
        userId,
        'substitution',
        provider.name,
        provider.model,
        true
      );

      return substitutions;
    } catch (error) {
      await this.rateLimitService.recordUsage(
        userId,
        'substitution',
        provider.name,
        provider.model,
        false,
        error instanceof Error ? error.message : undefined
      );

      throw error;
    }
  }

  async getCookingAdvice(
    userId: string,
    question: string,
    recipeContext?: { recipeId?: string; step?: number }
  ): Promise<string> {
    // Check rate limits
    const limitCheck = await this.canUserGenerateRecipe(userId);
    if (!limitCheck.allowed) {
      throw new Error('Rate limit exceeded');
    }

    const provider = this.providerFactory.getDefaultProvider();

    // Build context if recipe is provided
    let context;
    if (recipeContext?.recipeId) {
      const recipe = await this.recipeRepository.findById(recipeContext.recipeId);
      if (recipe) {
        context = {
          recipeTitle: recipe.title,
          currentStep: recipeContext.step,
          ingredients: recipe.ingredients.map(i => i.name),
        };
      }
    }

    try {
      const advice = await provider.getCookingAdvice(question, context);

      // Record usage
      await this.rateLimitService.recordUsage(
        userId,
        'cooking_advice',
        provider.name,
        provider.model,
        true
      );

      return advice;
    } catch (error) {
      await this.rateLimitService.recordUsage(
        userId,
        'cooking_advice',
        provider.name,
        provider.model,
        false,
        error instanceof Error ? error.message : undefined
      );

      throw error;
    }
  }

  async canUserGenerateRecipe(userId: string): Promise<RateLimitResult> {
    return this.rateLimitService.checkLimit(userId, 'generate_recipe');
  }

  async getRemainingQuota(
    userId: string
  ): Promise<{ daily: number; monthly: number; resetAt: Date }> {
    const dailyStats = await this.rateLimitService.getUsageStats(userId, 'generate_recipe', 'day');
    const monthlyStats = await this.rateLimitService.getUsageStats(userId, 'generate_recipe', 'month');

    return {
      daily: dailyStats.limit === -1 ? -1 : Math.max(0, dailyStats.limit - dailyStats.used),
      monthly: monthlyStats.limit === -1 ? -1 : Math.max(0, monthlyStats.limit - monthlyStats.used),
      resetAt: dailyStats.resetAt,
    };
  }
}
