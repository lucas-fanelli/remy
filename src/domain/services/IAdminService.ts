import { Role } from '@prisma/client';

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  role: Role;
  isVerified: boolean;
  createdAt: Date;
  _count?: {
    posts: number;
    comments: number;
    followers: number;
    following: number;
  };
}

export interface AdminRecipe {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  userId: string;
  createdAt: Date;
  user: {
    username: string;
    email: string;
  };
  _count?: {
    likes: number;
    comments: number;
  };
}

export interface AdminComment {
  id: string;
  text: string;
  postId: string;
  userId: string;
  createdAt: Date;
  user: {
    username: string;
    email: string;
  };
  post: {
    title: string | null;
  };
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalRecipes: number;
  totalComments: number;
  totalLikes: number;
  newUsersToday: number;
  newRecipesToday: number;
}

export interface IAdminService {
  // User management
  getAllUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
  }): Promise<{ users: AdminUser[]; total: number }>;

  promoteToAdmin(userId: string): Promise<AdminUser>;
  demoteToUser(userId: string): Promise<AdminUser>;
  deleteUser(userId: string): Promise<void>;

  // Recipe management
  getAllRecipes(options?: {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
  }): Promise<{ recipes: AdminRecipe[]; total: number }>;

  deleteRecipe(recipeId: string): Promise<void>;

  // Comment management
  getAllComments(options?: {
    page?: number;
    limit?: number;
    postId?: string;
    userId?: string;
  }): Promise<{ comments: AdminComment[]; total: number }>;

  deleteComment(commentId: string): Promise<void>;

  // Statistics
  getStats(): Promise<AdminStats>;
}
