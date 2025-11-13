import { UserPantry, PantryIngredient } from '../types/pantry';

/**
 * Pantry Repository Interface
 * Follows Interface Segregation Principle and Dependency Inversion Principle
 */
export interface IPantryRepository {
  /**
   * Get user's pantry
   */
  findByUserId(userId: string): Promise<UserPantry | null>;

  /**
   * Create a new pantry for a user
   */
  create(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry>;

  /**
   * Update user's pantry ingredients
   */
  update(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry>;

  /**
   * Add ingredients to user's pantry
   */
  addIngredients(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry>;

  /**
   * Remove ingredients from user's pantry
   */
  removeIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry>;

  /**
   * Clear all ingredients from user's pantry
   */
  clearPantry(userId: string): Promise<void>;

  /**
   * Check if user has a pantry
   */
  exists(userId: string): Promise<boolean>;
}
