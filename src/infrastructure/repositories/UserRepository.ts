import { User, Role, PrismaClient } from '@prisma/client';
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
        role: data.role,
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

  async updateRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async search(query: string, limit: number = 10, offset: number = 0): Promise<User[]> {
    // Exclude email and password at the query level so sensitive data never
    // leaves the database layer. The Prisma select returns a partial object
    // that is cast to User — callers (e.g. UserService.searchUsers) should
    // already strip password, but this provides defense-in-depth.
    return this.prisma.user.findMany({
      where: {
        isPrivate: false,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatar: true,
        website: true,
        role: true,
        isVerified: true,
        isPrivate: true,
        createdAt: true,
        updatedAt: true,
        // email and password intentionally excluded
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    }) as unknown as User[];
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
