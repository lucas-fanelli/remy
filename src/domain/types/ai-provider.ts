import { Recipe, DifficultyLevel } from './recipe';

/**
 * AI Provider Types - Strategy Pattern for pluggable AI providers
 */

export interface AIRecipeRequest {
  ingredients: string[];
  preferences?: RecipePreferences;
  userId: string;
}

export interface RecipePreferences {
  cuisine?: string;
  difficulty?: DifficultyLevel;
  maxCookingTime?: number;
  dietary?: string[]; // ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo"]
  mealType?: string; // "breakfast", "lunch", "dinner", "dessert", "snack", "appetizer"
  servings?: number;
  spicyLevel?: string; // "mild", "medium", "hot", "extra-hot"
  additionalInstructions?: string; // Free-form text for special requests
}

export interface AIRecipeResponse {
  recipe: Recipe;
  provider: string;
  model: string;
  tokensUsed?: number;
  generatedAt: Date;
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  requestsPerDay: number;
  costPerRequest?: number;
}

export interface CookingContext {
  recipeTitle?: string;
  currentStep?: number;
  ingredients?: string[];
}

/**
 * AI Provider Interface - all providers must implement this
 * Follows Open/Closed Principle: Open for extension, closed for modification
 */
export interface IAIRecipeProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Generate a complete recipe from ingredients
   */
  generateRecipe(request: AIRecipeRequest): Promise<AIRecipeResponse>;

  /**
   * Suggest ingredient substitutions
   */
  suggestSubstitutions(ingredient: string, context: string): Promise<string[]>;

  /**
   * Get cooking advice for a question
   */
  getCookingAdvice(question: string, context?: CookingContext): Promise<string>;

  /**
   * Get rate limit information for this provider
   */
  getRateLimitInfo(): RateLimitInfo;

  /**
   * Validate if the provider is properly configured
   */
  isConfigured(): boolean;
}
