import { User, Role, PrismaClient } from '@prisma/client';
import {
  IUserRepository,
  CreateUserDTO,
  ProfileUpdate,
  UpdateUserDTO,
} from '@/domain/repositories/IUserRepository';
import { acceptAllPending } from '@/lib/follows/requests';

const IGNORING_CASE_LOOKUP_LIMIT = 10;

// Prisma implements the insensitive `equals` with ILIKE, where "_" and "%" in the
// value act as wildcards ("probe_user" would also match "probeXuser"), so the
// rows that come back are compared again here.
function equalsIgnoringCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

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

  async findAllByEmailIgnoringCase(email: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      take: IGNORING_CASE_LOOKUP_LIMIT,
    });
    return users.filter((user) => equalsIgnoringCase(user.email, email));
  }

  async findAllByUsernameIgnoringCase(username: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { username: { equals: username, mode: 'insensitive' } },
      take: IGNORING_CASE_LOOKUP_LIMIT,
    });
    return users.filter((user) => equalsIgnoringCase(user.username, username));
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

  /**
   * A save that makes the account public takes every pending follow request with it, as
   * follows. The sweep and the update are one transaction, so they commit together or not
   * at all: afterwards no request waits on a public account, for an approval nobody will
   * be asked for; and if either half fails, the account is still private with its requests
   * still pending, and the save reports a failure that is true.
   *
   * The sweep runs on EVERY save that sets isPrivate to false, not only one that turns it
   * from true. Telling the two apart means reading the old value first, and that read, made
   * without the sweep's lock, can be stale by the time the update lands: another tab making
   * the account private in between would leave the requests that arrive meanwhile pending
   * on a public account. On an account that was already public the sweep claims nothing,
   * and no one is told anything.
   *
   * The sweep goes before the update, as acceptAllPending asks: its comment has the deadlock
   * the other order risks.
   */
  async updateProfile(id: string, data: UpdateUserDTO): Promise<ProfileUpdate> {
    // Private, or privacy not part of this save: there is nothing to accept
    if (data.isPrivate !== false) {
      return { user: await this.prisma.user.update({ where: { id }, data }), accepted: [] };
    }

    return this.prisma.$transaction(async (tx) => {
      const { accepted } = await acceptAllPending(tx, id);
      const user = await tx.user.update({ where: { id }, data });
      return { user, accepted };
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          // JWTs issued before this moment are rejected by AuthService.validateToken
          passwordChangedAt: new Date(),
        },
      });

      // A reset link requested under the old password must not outlive it
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });

      return user;
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
    // Private accounts are found too. Search used to leave them out, and a private account
    // nobody can find is one nobody can ask to follow — the only way into it. Finding one
    // shows its header, never its recipes (src/lib/privacy/visibility.ts).
    //
    // Because private accounts come back, the select is the profile HEADER and nothing
    // more — what a locked profile shows anyone: no email or password, and no website,
    // role, verification or dates either. It is chosen here, at the query, so a caller that
    // spreads a row cannot send more than that; /api/users/search once did, and sent the
    // role and dates of everyone it found. The partial row is cast to User; both callers
    // (/api/search and /api/users/search) read these fields and no others.
    return this.prisma.user.findMany({
      where: {
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
        isPrivate: true,
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
