import { IRecipeService } from '@/domain/services/IRecipeService';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { Recipe, CreateRecipeDTO, UpdateRecipeDTO, RecipeSearchOptions } from '@/domain/types/recipe';

/**
 * Recipe Service - handles business logic for recipes
 * Follows Single Responsibility Principle
 */
export class RecipeService implements IRecipeService {
  constructor(private recipeRepository: IRecipeRepository) {}

  async createRecipe(data: CreateRecipeDTO): Promise<Recipe> {
    // Validate recipe data
    const validation = await this.validateRecipeData(data);
    if (!validation.valid) {
      throw new Error(`Recipe validation failed: ${validation.errors.join(', ')}`);
    }

    // Create the recipe
    return this.recipeRepository.create(data);
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    return this.recipeRepository.findById(id);
  }

  async getUserRecipes(userId: string, limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.findByUserId(userId, limit, offset);
  }

  async searchRecipes(options: RecipeSearchOptions): Promise<Recipe[]> {
    return this.recipeRepository.search(options);
  }

  async updateRecipe(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe> {
    // Check if recipe exists and belongs to user
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new Error('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new Error('Unauthorized: You can only update your own recipes');
    }

    return this.recipeRepository.update(id, data);
  }

  async deleteRecipe(id: string, userId: string): Promise<void> {
    // Check if recipe exists and belongs to user
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new Error('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own recipes');
    }

    return this.recipeRepository.delete(id);
  }

  async getRecentRecipes(limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.getRecent(limit, offset);
  }

  async getRecipesByCuisine(cuisine: string, limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.getByCuisine(cuisine, limit, offset);
  }

  async getRecipesByDifficulty(difficulty: string, limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.getByDifficulty(difficulty, limit, offset);
  }

  async validateRecipeData(data: CreateRecipeDTO): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate required fields
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }
    if (data.title && data.title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Description is required');
    }
    if (data.description && data.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

    if (!data.imageUrl || data.imageUrl.trim().length === 0) {
      errors.push('Image URL is required');
    }

    // Validate numeric fields
    if (data.cookingTime <= 0) {
      errors.push('Cooking time must be greater than 0');
    }
    if (data.cookingTime > 720) {
      errors.push('Cooking time must be less than 12 hours (720 minutes)');
    }

    if (data.prepTime < 0) {
      errors.push('Prep time cannot be negative');
    }
    if (data.prepTime > 480) {
      errors.push('Prep time must be less than 8 hours (480 minutes)');
    }

    if (data.servings <= 0) {
      errors.push('Servings must be greater than 0');
    }
    if (data.servings > 100) {
      errors.push('Servings must be less than 100');
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(data.difficulty)) {
      errors.push('Difficulty must be easy, medium, or hard');
    }

    // Validate ingredients
    if (!data.ingredients || data.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    } else {
      data.ingredients.forEach((ingredient, index) => {
        if (!ingredient.name || ingredient.name.trim().length === 0) {
          errors.push(`Ingredient ${index + 1}: name is required`);
        }
        if (!ingredient.amount || ingredient.amount.trim().length === 0) {
          errors.push(`Ingredient ${index + 1}: amount is required`);
        }
        if (!ingredient.unit || ingredient.unit.trim().length === 0) {
          errors.push(`Ingredient ${index + 1}: unit is required`);
        }
      });
    }

    // Validate instructions
    if (!data.instructions || data.instructions.length === 0) {
      errors.push('At least one instruction step is required');
    } else {
      data.instructions.forEach((instruction, index) => {
        if (!instruction.description || instruction.description.trim().length === 0) {
          errors.push(`Instruction ${index + 1}: description is required`);
        }
        if (instruction.step !== index + 1) {
          errors.push(`Instruction ${index + 1}: step number must match position`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
