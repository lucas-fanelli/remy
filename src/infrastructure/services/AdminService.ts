import { Prisma, PrismaClient, Role } from '@prisma/client';
import {
  IAdminService,
  AdminUser,
  AdminRecipe,
  AdminComment,
  AdminStats,
} from '@/domain/services/IAdminService';

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 1) return '***@***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 1, 2));
  const dotIdx = domain.lastIndexOf('.');
  if (dotIdx < 1) return `${maskedLocal}@***`;
  const domainName = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx);
  const maskedDomain = domainName[0] + '*'.repeat(Math.max(domainName.length - 1, 2));
  return `${maskedLocal}@${maskedDomain}${tld}`;
}

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

    const where: Prisma.UserWhereInput = {};

    if (options?.search) {
      where.OR = [
        { username: { contains: options.search, mode: 'insensitive' } },
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

    const maskedUsers = users.map((u) => ({ ...u, email: maskEmail(u.email) }));
    return { users: maskedUsers as AdminUser[], total };
  }

  async promoteToAdmin(userId: string): Promise<AdminUser> {
    // Check if already admin to avoid unnecessary write
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true, followers: true, following: true } },
      },
    });
    if (existing?.role === 'ADMIN') return existing as AdminUser;

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

    const where: Prisma.PostWhereInput = {};

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

    const maskedRecipes = recipes.map((r) => ({
      ...r,
      user: { ...r.user, email: maskEmail(r.user.email) },
    }));
    return { recipes: maskedRecipes as AdminRecipe[], total };
  }

  async deleteRecipe(recipeId: string): Promise<{ imageUrl: string | null }> {
    const deleted = await this.prisma.post.delete({
      where: { id: recipeId },
      select: { imageUrl: true },
    });

    return { imageUrl: deleted.imageUrl };
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

    const where: Prisma.CommentWhereInput = {};

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

    const maskedComments = comments.map((c) => ({
      ...c,
      user: { ...c.user, email: maskEmail(c.user.email) },
    }));
    return { comments: maskedComments as AdminComment[], total };
  }

  async deleteComment(commentId: string): Promise<void> {
    // Comments and ratings are separate entities — deleting a comment
    // does not affect ratings, so no recalculation is needed.
    const { count } = await this.prisma.comment.deleteMany({
      where: { id: commentId },
    });

    if (count === 0) {
      throw new Error('COMMENT_NOT_FOUND');
    }
  }

  // ============ STATISTICS ============

  // Simple in-memory cache with short TTL to avoid hammering the DB on rapid admin page loads
  private static statsCache: { data: AdminStats; timestamp: number } | null = null;
  private static readonly STATS_CACHE_TTL = 15_000; // 15 seconds

  /** Clear stats cache — exposed for testing */
  static _clearStatsCache(): void {
    AdminService.statsCache = null;
  }

  async getStats(): Promise<AdminStats> {
    if (
      AdminService.statsCache &&
      Date.now() - AdminService.statsCache.timestamp < AdminService.STATS_CACHE_TTL
    ) {
      return AdminService.statsCache.data;
    }

    const stats = await this.fetchStats();
    AdminService.statsCache = { data: stats, timestamp: Date.now() };
    return stats;
  }

  private async fetchStats(): Promise<AdminStats> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [row] = await this.prisma.$queryRaw<
      [
        {
          totalUsers: bigint;
          totalAdmins: bigint;
          totalRecipes: bigint;
          totalComments: bigint;
          totalLikes: bigint;
          newUsersToday: bigint;
          newRecipesToday: bigint;
        },
      ]
    >`
      SELECT
        (SELECT COUNT(*) FROM "User")::bigint AS "totalUsers",
        (SELECT COUNT(*) FROM "User" WHERE role = 'ADMIN')::bigint AS "totalAdmins",
        (SELECT COUNT(*) FROM "Post")::bigint AS "totalRecipes",
        (SELECT COUNT(*) FROM "Comment")::bigint AS "totalComments",
        (SELECT COUNT(*) FROM "Like")::bigint AS "totalLikes",
        (SELECT COUNT(*) FROM "User" WHERE "createdAt" >= ${today})::bigint AS "newUsersToday",
        (SELECT COUNT(*) FROM "Post" WHERE "createdAt" >= ${today})::bigint AS "newRecipesToday"
    `;

    return {
      totalUsers: Number(row.totalUsers),
      totalAdmins: Number(row.totalAdmins),
      totalRecipes: Number(row.totalRecipes),
      totalComments: Number(row.totalComments),
      totalLikes: Number(row.totalLikes),
      newUsersToday: Number(row.newUsersToday),
      newRecipesToday: Number(row.newRecipesToday),
    };
  }
}
