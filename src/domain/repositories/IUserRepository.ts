import { User, Role } from '@prisma/client';

// Repository interface following Interface Segregation Principle (ISP)
// and Dependency Inversion Principle (DIP)

export type CreateUserDTO = {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  role?: Role;
};

export type UpdateUserDTO = {
  email?: string;
  username?: string;
  fullName?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  isPrivate?: boolean;
};

export interface IUserRepository {
  // Create
  create(data: CreateUserDTO): Promise<User>;

  // Read
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findMany(skip?: number, take?: number): Promise<User[]>;

  // Update
  update(id: string, data: UpdateUserDTO): Promise<User>;
  updatePassword(id: string, hashedPassword: string): Promise<User>;
  updateRole(id: string, role: Role): Promise<User>;

  // Delete
  delete(id: string): Promise<User>;

  // Search
  search(query: string, limit?: number): Promise<User[]>;

  // Utility
  exists(email: string, username: string): Promise<boolean>;
  count(): Promise<number>;
}
