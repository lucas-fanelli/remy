import { PrismaClient, Role } from '@prisma/client';
import {
  IAdminService,
  AdminUser,
  AdminRecipe,
  AdminComment,
  AdminStats,
} from '@/domain/services/IAdminService';

/**
 * AdminService - Handles all admin operations
 * Single Responsibility: Only admin management logic
 */
export class AdminService implements IAdminService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============ USER MANAGEMENT ============

  async getAllUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
  }): Promise<{ users: AdminUser[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.search) {
      where.OR = [
        { username: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { fullName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.role) {
      where.role = options.role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          avatar: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
              comments: true,
              followers: true,
              following: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users as AdminUser[], total };
  }

  async promoteToAdmin(userId: string): Promise<AdminUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    return user as AdminUser;
  }

  async demoteToUser(userId: string): Promise<AdminUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER' },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    return user as AdminUser;
  }

  async deleteUser(userId: string): Promise<void> {
    // Cascade delete is handled by Prisma schema
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // ============ RECIPE MANAGEMENT ============

  async getAllRecipes(options?: {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
  }): Promise<{ recipes: AdminRecipe[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    const [recipes, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          userId: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { recipes: recipes as AdminRecipe[], total };
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    await this.prisma.post.delete({
      where: { id: recipeId },
    });
  }

  // ============ COMMENT MANAGEMENT ============

  async getAllComments(options?: {
    page?: number;
    limit?: number;
    postId?: string;
    userId?: string;
  }): Promise<{ comments: AdminComment[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.postId) {
      where.postId = options.postId;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          text: true,
          postId: true,
          userId: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          post: {
            select: {
              title: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { comments: comments as AdminComment[], total };
  }

  async deleteComment(commentId: string): Promise<void> {
    // Get comment to find associated recipe
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    // Recalculate cached rating for the recipe after comment deletion
    if (comment?.postId) {
      const agg = await this.prisma.rating.aggregate({
        where: { postId: comment.postId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await this.prisma.post.update({
        where: { id: comment.postId },
        data: {
          averageRating: Math.round((agg._avg.rating || 0) * 10) / 10,
          reviewCount: agg._count.rating || 0,
        },
      });
    }
  }

  // ============ STATISTICS ============

  async getStats(): Promise<AdminStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalAdmins,
      totalRecipes,
      totalComments,
      totalLikes,
      newUsersToday,
      newRecipesToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.post.count(),
      this.prisma.comment.count(),
      this.prisma.like.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.post.count({ where: { createdAt: { gte: today } } }),
    ]);

    return {
      totalUsers,
      totalAdmins,
      totalRecipes,
      totalComments,
      totalLikes,
      newUsersToday,
      newRecipesToday,
    };
  }
}
