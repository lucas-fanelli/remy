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
