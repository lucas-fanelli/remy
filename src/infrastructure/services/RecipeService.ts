import { Prisma } from '@prisma/client';
// striptags strips HTML tags but NOT attribute-based XSS vectors. React's JSX auto-escaping
// is the primary XSS defense. If raw HTML rendering is ever added, migrate to DOMPurify.
import striptags from 'striptags';
import { ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { IRecipeRepository, RecipeCounts } from '@/domain/repositories/IRecipeRepository';
import { IRecipeService } from '@/domain/services/IRecipeService';
import {
  Recipe,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeSearchOptions,
} from '@/domain/types/recipe';
import { UNIT_TO_TASTE } from '@/lib/constants';

/**
 * Recipe Service - handles business logic for recipes
 * Follows Single Responsibility Principle
 */
export class RecipeService implements IRecipeService {
  constructor(private recipeRepository: IRecipeRepository) {}

  private stripHtml(s: string): string {
    return striptags(s).trim();
  }

  async createRecipe(data: CreateRecipeDTO): Promise<Recipe> {
    // Sanitize text fields to prevent stored XSS
    if (data.title) data.title = this.stripHtml(data.title);
    if (data.description) data.description = this.stripHtml(data.description);
    if (data.caption) data.caption = this.stripHtml(data.caption);
    if (data.ingredients) {
      data.ingredients.forEach((ingredient) => {
        if (ingredient.name) ingredient.name = this.stripHtml(ingredient.name);
      });
    }
    if (data.instructions) {
      data.instructions.forEach((instruction) => {
        if (instruction.description)
          instruction.description = this.stripHtml(instruction.description);
      });
    }

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

  async getRecipeWithCounts(id: string): Promise<{ recipe: Recipe; counts: RecipeCounts } | null> {
    const found = await this.recipeRepository.findByIdWithAuthor(id);
    if (!found) return null;
    return { recipe: found.recipe, counts: found.counts };
  }

  async getUserRecipes(userId: string, limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.findByUserId(userId, limit, offset);
  }

  async searchRecipes(options: RecipeSearchOptions): Promise<Recipe[]> {
    return this.recipeRepository.search(options);
  }

  async updateRecipe(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe> {
    // Sanitize text fields to prevent stored XSS
    if (data.title) data.title = this.stripHtml(data.title);
    if (data.description) data.description = this.stripHtml(data.description);
    if (data.caption) data.caption = this.stripHtml(data.caption);
    if (data.ingredients) {
      data.ingredients.forEach((ingredient) => {
        if (ingredient.name) ingredient.name = this.stripHtml(ingredient.name);
      });
    }
    if (data.instructions) {
      data.instructions.forEach((instruction) => {
        if (instruction.description)
          instruction.description = this.stripHtml(instruction.description);
      });
    }

    // Validate any fields present in the update DTO
    const validation = await this.validateUpdateData(data);
    if (!validation.valid) {
      throw new ValidationError(`Recipe validation failed: ${validation.errors.join(', ')}`);
    }

    // Atomic ownership check + update via where clause
    try {
      return await this.recipeRepository.updateWhere(id, userId, data);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const exists = await this.recipeRepository.exists(id);
        if (exists) {
          throw new ForbiddenError('Unauthorized: You can only update your own recipes');
        }
        throw new NotFoundError('Recipe not found');
      }
      throw error;
    }
  }

  async deleteRecipe(id: string, userId: string): Promise<{ imageUrl: string | null }> {
    // Atomic ownership check + delete via where clause
    try {
      return await this.recipeRepository.deleteWhere(id, userId);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const exists = await this.recipeRepository.exists(id);
        if (exists) {
          throw new ForbiddenError('Unauthorized: You can only delete your own recipes');
        }
        throw new NotFoundError('Recipe not found');
      }
      throw error;
    }
  }

  async getRecentRecipes(limit?: number, offset?: number): Promise<Recipe[]> {
    return this.recipeRepository.getRecent(limit, offset);
  }

  async getRecipesByDifficulty(
    difficulty: string,
    limit?: number,
    offset?: number
  ): Promise<Recipe[]> {
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

    // Validate ingredient/instruction count limits
    if (data.ingredients && data.ingredients.length > 100) errors.push('Maximum 100 ingredients');
    if (data.instructions && data.instructions.length > 50) errors.push('Maximum 50 steps');

    // Validate ingredients
    if (!data.ingredients || data.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    } else {
      data.ingredients.forEach((ingredient, index) => {
        if (!ingredient.name || ingredient.name.trim().length === 0) {
          errors.push(`Ingredient ${index + 1}: name is required`);
        }
        // Allow empty amount for "to taste" ingredients
        if (
          ingredient.unit !== UNIT_TO_TASTE &&
          (!ingredient.amount || ingredient.amount.trim().length === 0)
        ) {
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

  private async validateUpdateData(
    data: UpdateRecipeDTO
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (data.title !== undefined) {
      if (data.title.trim().length === 0) {
        errors.push('Title is required');
      }
      if (data.title.length > 100) {
        errors.push('Title must be less than 100 characters');
      }
    }

    if (data.description !== undefined) {
      if (data.description.trim().length === 0) {
        errors.push('Description is required');
      }
      if (data.description.length > 500) {
        errors.push('Description must be less than 500 characters');
      }
    }

    if (data.cookingTime !== undefined) {
      if (data.cookingTime <= 0) {
        errors.push('Cooking time must be greater than 0');
      }
      if (data.cookingTime > 720) {
        errors.push('Cooking time must be less than 12 hours (720 minutes)');
      }
    }

    if (data.prepTime !== undefined) {
      if (data.prepTime < 0) {
        errors.push('Prep time cannot be negative');
      }
      if (data.prepTime > 480) {
        errors.push('Prep time must be less than 8 hours (480 minutes)');
      }
    }

    if (data.servings !== undefined) {
      if (data.servings <= 0) {
        errors.push('Servings must be greater than 0');
      }
      if (data.servings > 100) {
        errors.push('Servings must be less than 100');
      }
    }

    if (data.difficulty !== undefined) {
      const validDifficulties = ['easy', 'medium', 'hard'];
      if (!validDifficulties.includes(data.difficulty)) {
        errors.push('Difficulty must be easy, medium, or hard');
      }
    }

    if (data.ingredients !== undefined) {
      if (data.ingredients.length > 100) errors.push('Maximum 100 ingredients');
      if (data.ingredients.length === 0) {
        errors.push('At least one ingredient is required');
      } else {
        data.ingredients.forEach((ingredient, index) => {
          if (!ingredient.name || ingredient.name.trim().length === 0) {
            errors.push(`Ingredient ${index + 1}: name is required`);
          }
          if (
            ingredient.unit !== UNIT_TO_TASTE &&
            (!ingredient.amount || ingredient.amount.trim().length === 0)
          ) {
            errors.push(`Ingredient ${index + 1}: amount is required`);
          }
          if (!ingredient.unit || ingredient.unit.trim().length === 0) {
            errors.push(`Ingredient ${index + 1}: unit is required`);
          }
        });
      }
    }

    if (data.instructions !== undefined) {
      if (data.instructions.length > 50) errors.push('Maximum 50 steps');
      if (data.instructions.length === 0) {
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
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
