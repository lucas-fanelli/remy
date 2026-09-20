import { Recipe, CreateRecipeDTO, UpdateRecipeDTO, RecipeSearchOptions } from '../types/recipe';

/**
 * Who wrote a recipe, for access decisions. Kept out of `Recipe.author`, which is what
 * gets serialised to clients: a reader has no business knowing another user's id.
 */
export interface RecipeAuthor {
  id: string;
  isPrivate: boolean;
}

/**
 * How many people engaged with a recipe — as opposed to `ViewerState`, which is what the
 * one person reading it did. Every list endpoint has carried these; the single-recipe
 * endpoint did not, so the detail page showed a like count of zero until a separate probe
 * came back with the real number.
 */
export interface RecipeCounts {
  likes: number;
  comments: number;
}

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
   * Find a recipe together with the visibility of its author and its engagement counts,
   * in one query.
   *
   * Every list endpoint hides the recipes of private users; the single-recipe endpoint
   * has to make the same decision, and it cannot without knowing who the author is.
   */
  findByIdWithAuthor(
    id: string
  ): Promise<{ recipe: Recipe; author: RecipeAuthor; counts: RecipeCounts } | null>;

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
   * Update a recipe with atomic ownership check
   */
  updateWhere(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe>;

  /**
   * Delete a recipe
   */
  delete(id: string): Promise<void>;

  /**
   * Delete a recipe with atomic ownership check
   */
  deleteWhere(id: string, userId: string): Promise<{ imageUrl: string | null }>;

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
