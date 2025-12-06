/**
 * Domain types for Recipe posts
 */

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Instruction {
  step: number;
  description: string;
  image?: string;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  userId: string;

  // Recipe details
  cookingTime: number;  // in minutes
  prepTime: number;     // in minutes
  servings: number;
  difficulty: DifficultyLevel;
  ingredients: Ingredient[];
  instructions: Instruction[];

  // Optional caption for social aspect
  caption?: string;

  // Author information (optional, populated when needed)
  author?: {
    username: string;
    fullName?: string;
    avatar?: string;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeDTO {
  title: string;
  description: string;
  imageUrl: string;
  userId: string;

  cookingTime: number;
  prepTime: number;
  servings: number;
  difficulty: DifficultyLevel;
  ingredients: Ingredient[];
  instructions: Instruction[];

  caption?: string;
}

export interface UpdateRecipeDTO {
  title?: string;
  description?: string;
  imageUrl?: string;

  cookingTime?: number;
  prepTime?: number;
  servings?: number;
  difficulty?: DifficultyLevel;
  ingredients?: Ingredient[];
  instructions?: Instruction[];

  caption?: string | null;
}

export interface RecipeFilters {
  difficulty?: DifficultyLevel;
  maxCookingTime?: number;
  maxPrepTime?: number;
  userId?: string;
}

export interface RecipeSearchOptions {
  query?: string;
  filters?: RecipeFilters;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'likes' | 'cookingTime';
  sortOrder?: 'asc' | 'desc';
}
