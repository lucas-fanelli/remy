import { Post, Prisma, PrismaClient } from '@prisma/client';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import {
  Recipe,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeSearchOptions,
  Ingredient,
  Instruction,
  DifficultyLevel,
} from '@/domain/types/recipe';

/**
 * Concrete implementation of IRecipeRepository using Prisma
 * Follows Single Responsibility Principle - only handles data access for recipes
 */
export class RecipeRepository implements IRecipeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateRecipeDTO): Promise<Recipe> {
    const post = await this.prisma.post.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        userId: data.userId,
        caption: data.caption,
        cookingTime: data.cookingTime,
        prepTime: data.prepTime,
        servings: data.servings,
        difficulty: data.difficulty,
        ingredients: data.ingredients as any,
        instructions: data.instructions as any,
      },
    });

    return this.mapToRecipe(post);
  }

  async findById(id: string): Promise<Recipe | null> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
    });

    return post ? this.mapToRecipe(post) : null;
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return posts.map(this.mapToRecipe);
  }

  async search(options: RecipeSearchOptions): Promise<Recipe[]> {
    const {
      query,
      filters,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.PostWhereInput = {};

    // Apply text search
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Apply filters
    if (filters) {
      // Note: cuisine field doesn't exist in Post model, removed from filters
      if (filters.difficulty) {
        where.difficulty = filters.difficulty;
      }
      if (filters.maxCookingTime) {
        where.cookingTime = { lte: filters.maxCookingTime };
      }
      if (filters.maxPrepTime) {
        where.prepTime = { lte: filters.maxPrepTime };
      }
      if (filters.userId) {
        where.userId = filters.userId;
      }
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
    });

    return posts.map(this.mapToRecipe);
  }

  async update(id: string, data: UpdateRecipeDTO): Promise<Recipe> {
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        caption: data.caption,
        cookingTime: data.cookingTime,
        prepTime: data.prepTime,
        servings: data.servings,
        difficulty: data.difficulty,
        ingredients: data.ingredients as any,
        instructions: data.instructions as any,
      },
    });

    return this.mapToRecipe(post);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({
      where: { id },
    });
  }

  async updateWhere(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe> {
    const post = await this.prisma.post.update({
      where: { id, userId },
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        caption: data.caption,
        cookingTime: data.cookingTime,
        prepTime: data.prepTime,
        servings: data.servings,
        difficulty: data.difficulty,
        ingredients: data.ingredients as any,
        instructions: data.instructions as any,
      },
    });
    return this.mapToRecipe(post);
  }

  async deleteWhere(id: string, userId: string): Promise<void> {
    await this.prisma.post.delete({
      where: { id, userId },
    });
  }

  async getRecent(limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return posts.map(this.mapToRecipe);
  }

  async getByDifficulty(difficulty: string, limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      where: { difficulty },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return posts.map(this.mapToRecipe);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.post.count({
      where: { id },
    });
    return count > 0;
  }

  async count(): Promise<number> {
    return this.prisma.post.count();
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.post.count({
      where: { userId },
    });
  }

  /**
   * Maps a Prisma Post to a Recipe domain model
   */
  private mapToRecipe(
    post: Post & {
      user?: { username: string; fullName: string | null; avatar: string | null } | null;
    }
  ): Recipe {
    return {
      id: post.id,
      title: post.title || '',
      description: post.description || '',
      imageUrl: post.imageUrl,
      userId: post.userId,
      cookingTime: post.cookingTime || 0,
      prepTime: post.prepTime || 0,
      servings: post.servings || 0,
      difficulty: (post.difficulty as DifficultyLevel) || 'medium',
      ingredients: (post.ingredients as unknown as Ingredient[]) || [],
      instructions: (post.instructions as unknown as Instruction[]) || [],
      caption: post.caption || undefined,
      averageRating: post.averageRating ?? undefined,
      totalRatings: post.reviewCount ?? undefined,
      author: post.user
        ? {
            username: post.user.username,
            fullName: post.user.fullName || undefined,
            avatar: post.user.avatar || undefined,
          }
        : undefined,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
