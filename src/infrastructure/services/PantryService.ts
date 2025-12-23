import { PrismaClient } from '@prisma/client';
import { IPantryRepository } from '@/domain/repositories/IPantryRepository';
import { IPantryService } from '@/domain/services/IPantryService';
import { UserPantry, PantryIngredient, IngredientCategory } from '@/domain/types/pantry';

/**
 * Pantry Service Implementation
 * Business logic for pantry management
 * Follows Single Responsibility Principle
 */
export class PantryService implements IPantryService {
  constructor(
    private pantryRepository: IPantryRepository,
    private prisma: PrismaClient
  ) {}

  async getUserPantry(userId: string): Promise<UserPantry | null> {
    return this.pantryRepository.findByUserId(userId);
  }

  async addIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry> {
    // Validate and categorize ingredients
    const ingredients: PantryIngredient[] = await Promise.all(
      ingredientNames.map(async (name) => {
        const category = await this.categorizeIngredient(name);
        return {
          name: name.trim(),
          category: category as IngredientCategory,
          addedAt: new Date(),
        };
      })
    );

    // Ensure ingredients exist in the master list
    await this.ensureIngredientsExist(ingredients);

    return this.pantryRepository.addIngredients(userId, ingredients);
  }

  async removeIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry> {
    if (ingredientNames.length === 0) {
      throw new Error('No ingredients specified for removal');
    }

    return this.pantryRepository.removeIngredients(userId, ingredientNames);
  }

  async clearPantry(userId: string): Promise<void> {
    const exists = await this.pantryRepository.exists(userId);
    if (!exists) {
      throw new Error('Pantry not found');
    }

    await this.pantryRepository.clearPantry(userId);
  }

  async searchIngredients(query: string, limit: number = 20): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });

    return ingredients.map((i) => i.name);
  }

  async categorizeIngredient(name: string): Promise<string> {
    // Check if ingredient exists in database
    const existing = await this.prisma.ingredient.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing.category;
    }

    // Simple categorization logic based on common patterns
    const nameLower = name.toLowerCase();

    // Vegetables
    if (
      /carrot|potato|tomato|onion|garlic|pepper|lettuce|spinach|broccoli|cauliflower|celery|cucumber|zucchini|eggplant|cabbage|kale|asparagus|mushroom|peas|beans|corn/i.test(
        nameLower
      )
    ) {
      return IngredientCategory.VEGETABLE;
    }

    // Fruits
    if (
      /apple|banana|orange|lemon|lime|berry|grape|mango|pineapple|peach|pear|plum|cherry|melon|avocado/i.test(
        nameLower
      )
    ) {
      return IngredientCategory.FRUIT;
    }

    // Proteins
    if (/chicken|beef|pork|fish|salmon|tuna|shrimp|turkey|lamb|tofu|egg|bacon/i.test(nameLower)) {
      return IngredientCategory.PROTEIN;
    }

    // Dairy
    if (/milk|cheese|butter|cream|yogurt|sour cream|mozzarella|parmesan|cheddar/i.test(nameLower)) {
      return IngredientCategory.DAIRY;
    }

    // Grains
    if (/rice|pasta|bread|flour|oat|wheat|quinoa|barley|noodle|tortilla/i.test(nameLower)) {
      return IngredientCategory.GRAIN;
    }

    // Spices & Herbs
    if (
      /salt|pepper|cumin|paprika|oregano|basil|thyme|rosemary|parsley|cilantro|cinnamon|ginger|turmeric|curry|chili|cayenne/i.test(
        nameLower
      )
    ) {
      return IngredientCategory.SPICE;
    }

    // Condiments & Sauces
    if (/oil|vinegar|sauce|ketchup|mustard|mayo|soy sauce|honey|sugar|syrup/i.test(nameLower)) {
      return IngredientCategory.CONDIMENT;
    }

    // Baking
    if (/baking powder|baking soda|yeast|vanilla|cocoa|chocolate/i.test(nameLower)) {
      return IngredientCategory.BAKING;
    }

    // Default to OTHER
    return IngredientCategory.OTHER;
  }

  /**
   * Ensure ingredients exist in the master ingredient table
   */
  private async ensureIngredientsExist(ingredients: PantryIngredient[]): Promise<void> {
    for (const ingredient of ingredients) {
      const exists = await this.prisma.ingredient.findFirst({
        where: {
          name: {
            equals: ingredient.name,
            mode: 'insensitive',
          },
        },
      });

      if (!exists) {
        await this.prisma.ingredient.create({
          data: {
            name: ingredient.name,
            category: ingredient.category,
          },
        });
      }
    }
  }
}
