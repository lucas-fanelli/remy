import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { IIngredientMatchService } from '@/domain/services/IIngredientMatchService';
import { RecipeMatch, IngredientMatchFilters } from '@/domain/types/pantry';
import { Recipe } from '@/domain/types/recipe';

/**
 * Ingredient Matching Service Implementation
 * Smart algorithm to match recipes with available ingredients
 * Follows Single Responsibility Principle
 */
export class IngredientMatchService implements IIngredientMatchService {
  constructor(private recipeRepository: IRecipeRepository) {}

  async findRecipesByIngredients(
    ingredients: string[],
    filters?: IngredientMatchFilters,
    viewerId: string | null = null
  ): Promise<RecipeMatch[]> {
    if (!ingredients || ingredients.length === 0) {
      return [];
    }

    // Fetch the recipes this viewer may see (with filters if provided). The repository
    // applies the privacy rule; matching only ever scores what it hands back.
    const recipes = await this.recipeRepository.search(
      {
        filters: filters
          ? {
              difficulty: filters.difficulty as any,
              maxCookingTime: filters.maxCookingTime,
            }
          : undefined,
        limit: 100, // Get more recipes for better matching
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      viewerId
    );

    // Calculate match for each recipe
    const matches: RecipeMatch[] = recipes
      .map((recipe) => {
        const recipeIngredients = this.extractIngredientNames(recipe);
        const matchPercentage = this.calculateMatchPercentage(recipeIngredients, ingredients);
        const missingIngredients = this.getMissingIngredients(recipeIngredients, ingredients);
        const matchedIngredients = this.getMatchedIngredients(recipeIngredients, ingredients);

        return {
          recipe,
          matchPercentage,
          missingIngredients,
          hasAllIngredients: missingIngredients.length === 0,
          matchedIngredients,
        };
      })
      .filter((match) => {
        // Apply minimum match percentage filter if specified
        if (filters?.minMatchPercentage) {
          return match.matchPercentage >= filters.minMatchPercentage;
        }
        // By default, show recipes with at least 50% match
        return match.matchPercentage >= 50;
      })
      // Sort by match percentage (highest first)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

    return matches;
  }

  calculateMatchPercentage(recipeIngredients: string[], userIngredients: string[]): number {
    if (!recipeIngredients || recipeIngredients.length === 0) {
      return 0;
    }

    const normalizedUser = this.normalizeIngredients(userIngredients);
    const normalizedRecipe = this.normalizeIngredients(recipeIngredients);

    let matchCount = 0;

    for (const recipeIng of normalizedRecipe) {
      // Check if user has this ingredient (or a close match)
      if (this.hasIngredient(recipeIng, normalizedUser)) {
        matchCount++;
      }
    }

    return Math.round((matchCount / normalizedRecipe.length) * 100);
  }

  getMissingIngredients(recipeIngredients: string[], userIngredients: string[]): string[] {
    const normalizedUser = this.normalizeIngredients(userIngredients);
    const normalizedRecipe = this.normalizeIngredients(recipeIngredients);

    const missing: string[] = [];

    for (let i = 0; i < recipeIngredients.length; i++) {
      const recipeIng = normalizedRecipe[i];
      if (!this.hasIngredient(recipeIng, normalizedUser)) {
        missing.push(recipeIngredients[i]); // Return original casing
      }
    }

    return missing;
  }

  getMatchedIngredients(recipeIngredients: string[], userIngredients: string[]): string[] {
    const normalizedUser = this.normalizeIngredients(userIngredients);
    const normalizedRecipe = this.normalizeIngredients(recipeIngredients);

    const matched: string[] = [];

    for (let i = 0; i < recipeIngredients.length; i++) {
      const recipeIng = normalizedRecipe[i];
      if (this.hasIngredient(recipeIng, normalizedUser)) {
        matched.push(recipeIngredients[i]); // Return original casing
      }
    }

    return matched;
  }

  /**
   * Extract ingredient names from a recipe
   */
  private extractIngredientNames(recipe: Recipe): string[] {
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return [];
    }

    return recipe.ingredients.map((ing) => ing.name);
  }

  /**
   * Normalize ingredients for comparison
   * - Convert to lowercase
   * - Remove extra spaces
   * - Remove common words like "fresh", "dried", etc.
   */
  private normalizeIngredients(ingredients: string[]): string[] {
    return ingredients.map((ing) => {
      let normalized = ing.toLowerCase().trim();

      // Remove common descriptors
      normalized = normalized
        .replace(
          /\b(fresh|dried|frozen|canned|chopped|diced|minced|sliced|ground|whole|organic|raw)\b/gi,
          ''
        )
        .trim();

      // Remove multiple spaces
      normalized = normalized.replace(/\s+/g, ' ');

      return normalized;
    });
  }

  /**
   * Check if user has an ingredient (fuzzy matching)
   */
  private hasIngredient(recipeIngredient: string, userIngredients: string[]): boolean {
    for (const userIng of userIngredients) {
      // Exact match
      if (recipeIngredient === userIng) {
        return true;
      }

      // Contains match (for compound ingredients)
      // e.g., "chicken breast" matches "chicken"
      if (recipeIngredient.includes(userIng) || userIng.includes(recipeIngredient)) {
        return true;
      }

      // Plural/singular variations
      if (this.arePluralVariations(recipeIngredient, userIng)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two words are plural/singular variations
   */
  private arePluralVariations(word1: string, word2: string): boolean {
    // Simple plural check - can be enhanced
    if (word1 + 's' === word2 || word2 + 's' === word1) {
      return true;
    }

    // Handle "es" plurals (tomato -> tomatoes)
    if (word1 + 'es' === word2 || word2 + 'es' === word1) {
      return true;
    }

    // Handle "ies" plurals (berry -> berries)
    if (word1.endsWith('y')) {
      const base = word1.slice(0, -1);
      if (base + 'ies' === word2) {
        return true;
      }
    }
    if (word2.endsWith('y')) {
      const base = word2.slice(0, -1);
      if (base + 'ies' === word1) {
        return true;
      }
    }

    return false;
  }
}
