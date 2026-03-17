import { IUserRepository } from '@/domain/repositories/IUserRepository';
import {
  IUserService,
  UpdateUserProfileDTO,
  UserPublicProfile,
} from '@/domain/services/IUserService';

// Single Responsibility Principle: Only handles user management operations
// Open/Closed Principle: Open for extension, closed for modification
export class UserService implements IUserService {
  constructor(private readonly userRepository: IUserRepository) {}

  async getUserById(userId: string): Promise<UserPublicProfile | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserByUsername(username: string): Promise<UserPublicProfile | null> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: UpdateUserProfileDTO): Promise<UserPublicProfile> {
    // Validate website URL if provided
    if (data.website) {
      try {
        new URL(data.website);
      } catch {
        throw new Error('Invalid website URL');
      }
    }

    // Validate bio length
    if (data.bio && data.bio.length > 300) {
      throw new Error('Bio must be 300 characters or less');
    }

    const user = await this.userRepository.update(userId, data);
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<UserPublicProfile[]> {
    const skip = (page - 1) * limit;
    const users = await this.userRepository.findMany(skip, limit);

    return users.map((user) => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async searchUsers(query: string, limit: number = 10): Promise<UserPublicProfile[]> {
    const users = await this.userRepository.search(query, limit);

    return users.map((user) => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }
}
