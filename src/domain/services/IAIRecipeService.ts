import { Recipe } from '../types/recipe';
import { AIRecipeRequest, RecipePreferences } from '../types/ai-provider';
import { RateLimitResult } from '../types/subscription';

/**
 * AI Recipe Service Interface
 * Orchestrates AI recipe generation with rate limiting
 */
export interface IAIRecipeService {
  /**
   * Generate a recipe using AI based on ingredients
   */
  generateRecipe(
    userId: string,
    ingredients: string[],
    preferences?: RecipePreferences,
    provider?: string
  ): Promise<Recipe>;

  /**
   * Suggest ingredient substitutions
   */
  suggestSubstitutions(
    userId: string,
    ingredient: string,
    context: string
  ): Promise<string[]>;

  /**
   * Get cooking advice from AI
   */
  getCookingAdvice(
    userId: string,
    question: string,
    recipeContext?: { recipeId?: string; step?: number }
  ): Promise<string>;

  /**
   * Check if user can generate a recipe (rate limit check)
   */
  canUserGenerateRecipe(userId: string): Promise<RateLimitResult>;

  /**
   * Get user's remaining AI quota
   */
  getRemainingQuota(userId: string): Promise<{
    daily: number;
    monthly: number;
    resetAt: Date;
  }>;
}
