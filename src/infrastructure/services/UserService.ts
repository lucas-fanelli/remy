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

    const { password: _, passwordChangedAt: _changedAt, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserByUsername(username: string): Promise<UserPublicProfile | null> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      return null;
    }

    const { password: _, passwordChangedAt: _changedAt, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: UpdateUserProfileDTO): Promise<UserPublicProfile> {
    // Validate website URL if provided
    if (data.website) {
      try {
        const url = new URL(data.website);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Website must use http or https protocol');
        }
        // Reject URLs with embedded credentials (e.g. https://user:pass@evil.com)
        if (url.username || url.password) {
          throw new Error('Website URL must not contain credentials');
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Invalid website URL');
      }
    }

    // Validate bio length
    if (data.bio && data.bio.length > 300) {
      throw new Error('Bio must be 300 characters or less');
    }

    const user = await this.userRepository.update(userId, data);
    const { password: _, passwordChangedAt: _changedAt, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<UserPublicProfile[]> {
    const skip = (page - 1) * limit;
    const users = await this.userRepository.findMany(skip, limit);

    return users.map((user) => {
      const { password: _, passwordChangedAt: _changedAt, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async searchUsers(
    query: string,
    limit: number = 10,
    offset?: number
  ): Promise<UserPublicProfile[]> {
    const users = await this.userRepository.search(query, limit, offset);

    return users.map((user) => {
      const { password: _, passwordChangedAt: _changedAt, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }
}
