import { User } from '@prisma/client';

export type UpdateUserProfileDTO = {
  fullName?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  isPrivate?: boolean;
};

export type UserPublicProfile = Omit<User, 'password'>;

// Interface for user management operations
export interface IUserService {
  getUserById(userId: string): Promise<UserPublicProfile | null>;
  getUserByUsername(username: string): Promise<UserPublicProfile | null>;
  updateProfile(userId: string, data: UpdateUserProfileDTO): Promise<UserPublicProfile>;
  deleteUser(userId: string): Promise<void>;
  getUsers(page: number, limit: number): Promise<UserPublicProfile[]>;
  searchUsers(query: string, limit: number): Promise<UserPublicProfile[]>;
}
