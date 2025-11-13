import { UserPantry, PantryIngredient } from '../types/pantry';

/**
 * Pantry Service Interface
 * Business logic for managing user pantries
 */
export interface IPantryService {
  /**
   * Get user's pantry
   */
  getUserPantry(userId: string): Promise<UserPantry | null>;

  /**
   * Add ingredients to pantry
   */
  addIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry>;

  /**
   * Remove ingredients from pantry
   */
  removeIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry>;

  /**
   * Clear entire pantry
   */
  clearPantry(userId: string): Promise<void>;

  /**
   * Get ingredient suggestions based on partial input
   */
  searchIngredients(query: string, limit?: number): Promise<string[]>;

  /**
   * Categorize an ingredient name
   */
  categorizeIngredient(name: string): Promise<string>;
}
