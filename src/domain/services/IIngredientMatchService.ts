import { RecipeMatch, IngredientMatchFilters } from '../types/pantry';

/**
 * Ingredient Matching Service Interface
 * Finds recipes that match user's available ingredients
 */
export interface IIngredientMatchService {
  /**
   * Find recipes that match the given ingredients
   */
  findRecipesByIngredients(
    ingredients: string[],
    filters?: IngredientMatchFilters
  ): Promise<RecipeMatch[]>;

  /**
   * Calculate match percentage for a specific recipe
   */
  calculateMatchPercentage(recipeIngredients: string[], userIngredients: string[]): number;

  /**
   * Get missing ingredients for a recipe
   */
  getMissingIngredients(recipeIngredients: string[], userIngredients: string[]): string[];

  /**
   * Get matched ingredients for a recipe
   */
  getMatchedIngredients(recipeIngredients: string[], userIngredients: string[]): string[];
}
