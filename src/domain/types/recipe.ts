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

/**
 * What the person reading the page did to this recipe. Lives here, next to Recipe, because
 * it is part of the vocabulary — not in the Prisma layer — so client components can name it
 * without dragging the database into their bundle.
 *
 * `null` is the signed-out reader: it does not mean "has not liked it", it means there is
 * nobody to have liked it. Keep the two apart; conflating them is the original bug.
 */
export interface ViewerState {
  liked: boolean;
  saved: boolean;
  cooked: boolean;
  /** This reader's own rating, 1-5, or null if they have not rated it. */
  myRating: number | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  userId: string;

  // Recipe details
  cookingTime: number; // in minutes
  prepTime: number; // in minutes
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

  // Rating information (optional, populated by API)
  // averageRating is nullable in DB (Float?) — null means "not yet rated"
  averageRating?: number | null;
  totalRatings?: number;

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
