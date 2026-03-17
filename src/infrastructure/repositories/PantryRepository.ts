import { PrismaClient, UserPantry as PrismaUserPantry } from '@prisma/client';
import { IPantryRepository } from '@/domain/repositories/IPantryRepository';
import { UserPantry, PantryIngredient } from '@/domain/types/pantry';

/**
 * Pantry Repository Implementation
 * Handles data access for user pantries
 * Follows Single Responsibility Principle
 */
export class PantryRepository implements IPantryRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserPantry | null> {
    const pantry = await this.prisma.userPantry.findUnique({
      where: { userId },
    });

    if (!pantry) return null;

    return this.mapToUserPantry(pantry);
  }

  async create(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry> {
    const pantry = await this.prisma.userPantry.create({
      data: {
        userId,
        ingredients: ingredients as any,
      },
    });

    return this.mapToUserPantry(pantry);
  }

  async update(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry> {
    const pantry = await this.prisma.userPantry.update({
      where: { userId },
      data: {
        ingredients: ingredients as any,
      },
    });

    return this.mapToUserPantry(pantry);
  }

  async addIngredients(userId: string, ingredients: PantryIngredient[]): Promise<UserPantry> {
    // Get existing pantry or create new one
    const pantry = await this.findByUserId(userId);

    if (!pantry) {
      return this.create(userId, ingredients);
    }

    // Merge new ingredients with existing ones (avoid duplicates)
    const existingNames = new Set(pantry.ingredients.map((i) => i.name.toLowerCase()));
    const newIngredients = ingredients.filter((i) => !existingNames.has(i.name.toLowerCase()));

    const updatedIngredients = [...pantry.ingredients, ...newIngredients];

    return this.update(userId, updatedIngredients);
  }

  async removeIngredients(userId: string, ingredientNames: string[]): Promise<UserPantry> {
    const pantry = await this.findByUserId(userId);
    if (!pantry) {
      throw new Error('Pantry not found');
    }

    const namesToRemove = new Set(ingredientNames.map((n) => n.toLowerCase()));
    const remainingIngredients = pantry.ingredients.filter(
      (i) => !namesToRemove.has(i.name.toLowerCase())
    );

    return this.update(userId, remainingIngredients);
  }

  async clearPantry(userId: string): Promise<void> {
    await this.prisma.userPantry.update({
      where: { userId },
      data: {
        ingredients: [],
      },
    });
  }

  async exists(userId: string): Promise<boolean> {
    const count = await this.prisma.userPantry.count({
      where: { userId },
    });
    return count > 0;
  }

  /**
   * Map Prisma UserPantry to domain UserPantry
   */
  private mapToUserPantry(pantry: PrismaUserPantry): UserPantry {
    return {
      id: pantry.id,
      userId: pantry.userId,
      ingredients: (pantry.ingredients as unknown as PantryIngredient[]) || [],
      updatedAt: pantry.updatedAt,
    };
  }
}
