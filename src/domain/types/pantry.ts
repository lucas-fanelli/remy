/**
 * Pantry and Ingredient Management Types
 */

export interface PantryIngredient {
  name: string;
  category: IngredientCategory;
  addedAt: Date;
}

export enum IngredientCategory {
  VEGETABLE = 'vegetable',
  FRUIT = 'fruit',
  PROTEIN = 'protein',
  DAIRY = 'dairy',
  GRAIN = 'grain',
  SPICE = 'spice',
  CONDIMENT = 'condiment',
  BAKING = 'baking',
  OTHER = 'other',
}

export interface UserPantry {
  id: string;
  userId: string;
  ingredients: PantryIngredient[];
  updatedAt: Date;
}

export interface IngredientData {
  id: string;
  name: string;
  category: string;
  createdAt: Date;
}

export interface RecipeMatch {
  recipe: any; // Will use Recipe type
  matchPercentage: number;
  missingIngredients: string[];
  hasAllIngredients: boolean;
  matchedIngredients: string[];
}

export interface IngredientMatchFilters {
  difficulty?: string;
  maxCookingTime?: number;
  minMatchPercentage?: number; // Only show recipes with at least X% match
  dietary?: string[];
  mealType?: string;
}
