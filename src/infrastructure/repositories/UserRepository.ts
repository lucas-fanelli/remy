import { User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import {
  IUserRepository,
  CreateUserDTO,
  UpdateUserDTO,
} from '@/domain/repositories/IUserRepository';

// Concrete implementation of IUserRepository
// Single Responsibility Principle: Only handles user data access
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserDTO): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
        fullName: data.fullName,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findMany(skip: number = 0, take: number = 10): Promise<User[]> {
    return this.prisma.user.findMany({
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async exists(email: string, username: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    return user !== null;
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}
