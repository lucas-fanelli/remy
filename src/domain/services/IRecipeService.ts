import { Recipe, CreateRecipeDTO, UpdateRecipeDTO, RecipeSearchOptions } from '../types/recipe';

/**
 * Service interface for Recipe business logic
 * Follows Interface Segregation Principle
 */
export interface IRecipeService {
  /**
   * Create a new recipe with validation
   */
  createRecipe(data: CreateRecipeDTO): Promise<Recipe>;

  /**
   * Get a recipe by ID
   */
  getRecipeById(id: string): Promise<Recipe | null>;

  /**
   * Get recipes by user
   */
  getUserRecipes(userId: string, limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Search recipes
   */
  searchRecipes(options: RecipeSearchOptions): Promise<Recipe[]>;

  /**
   * Update a recipe (with ownership validation)
   */
  updateRecipe(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe>;

  /**
   * Delete a recipe (with ownership validation)
   */
  deleteRecipe(id: string, userId: string): Promise<{ imageUrl: string | null }>;

  /**
   * Get recent recipes feed
   */
  getRecentRecipes(limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Get recipes by difficulty
   */
  getRecipesByDifficulty(difficulty: string, limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Validate recipe data
   */
  validateRecipeData(data: CreateRecipeDTO): Promise<{ valid: boolean; errors: string[] }>;
}
