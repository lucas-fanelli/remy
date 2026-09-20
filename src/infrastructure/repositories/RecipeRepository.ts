import { Post, Prisma, PrismaClient } from '@prisma/client';
import {
  IRecipeRepository,
  RecipeAuthor,
  RecipeCounts,
} from '@/domain/repositories/IRecipeRepository';
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

  private readonly defaultPostSelect = {
    id: true,
    title: true,
    description: true,
    imageUrl: true,
    userId: true,
    cookingTime: true,
    prepTime: true,
    servings: true,
    difficulty: true,
    ingredients: true,
    instructions: true,
    caption: true,
    averageRating: true,
    reviewCount: true,
    createdAt: true,
    updatedAt: true,
  } as const;

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
      select: this.defaultPostSelect,
    });

    return this.mapToRecipe(post as unknown as Post);
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

  async findByIdWithAuthor(
    id: string
  ): Promise<{ recipe: Recipe; author: RecipeAuthor; counts: RecipeCounts } | null> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            isPrivate: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) return null;

    // mapToRecipe only reads username/fullName/avatar off `user`; id and isPrivate are
    // handed back separately so they never reach the serialised recipe.
    return {
      recipe: this.mapToRecipe(post),
      author: { id: post.user.id, isPrivate: post.user.isPrivate },
      counts: { likes: post._count.likes, comments: post._count.comments },
    };
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: this.defaultPostSelect,
    });

    return posts.map((p) => this.mapToRecipe(p as unknown as Post));
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
      select: this.defaultPostSelect,
    });

    return this.mapToRecipe(post as unknown as Post);
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

  async deleteWhere(id: string, userId: string): Promise<{ imageUrl: string | null }> {
    const deleted = await this.prisma.post.delete({
      where: { id, userId },
      select: { imageUrl: true },
    });
    return { imageUrl: deleted.imageUrl };
  }

  async getRecent(limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: this.defaultPostSelect,
    });

    return posts.map((p) => this.mapToRecipe(p as unknown as Post));
  }

  async getByDifficulty(difficulty: string, limit = 20, offset = 0): Promise<Recipe[]> {
    const posts = await this.prisma.post.findMany({
      where: { difficulty },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: this.defaultPostSelect,
    });

    return posts.map((p) => this.mapToRecipe(p as unknown as Post));
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
   * Maps a Prisma Post (or select result) to a Recipe domain model.
   * Depends on: id, title, description, imageUrl, userId, cookingTime,
   * prepTime, servings, difficulty, ingredients, instructions, caption,
   * averageRating, reviewCount, createdAt, updatedAt (see defaultPostSelect).
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
      averageRating: post.averageRating ?? null,
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
