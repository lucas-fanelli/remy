import { Recipe, CreateRecipeDTO, UpdateRecipeDTO, RecipeSearchOptions } from '../types/recipe';

/**
 * Repository interface for Recipe operations
 * Follows Interface Segregation Principle and Dependency Inversion Principle
 */
export interface IRecipeRepository {
  /**
   * Create a new recipe
   */
  create(data: CreateRecipeDTO): Promise<Recipe>;

  /**
   * Find a recipe by ID
   */
  findById(id: string): Promise<Recipe | null>;

  /**
   * Find recipes by user ID
   */
  findByUserId(userId: string, limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Search recipes with filters and sorting
   */
  search(options: RecipeSearchOptions): Promise<Recipe[]>;

  /**
   * Update a recipe
   */
  update(id: string, data: UpdateRecipeDTO): Promise<Recipe>;

  /**
   * Delete a recipe
   */
  delete(id: string): Promise<void>;

  /**
   * Get recent recipes (feed)
   */
  getRecent(limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Get recipes by difficulty
   */
  getByDifficulty(difficulty: string, limit?: number, offset?: number): Promise<Recipe[]>;

  /**
   * Check if recipe exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Count total recipes
   */
  count(): Promise<number>;

  /**
   * Count recipes by user
   */
  countByUser(userId: string): Promise<number>;
}
