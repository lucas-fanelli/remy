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
  fullName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  website?: string | null;
  isPrivate?: boolean;
};

export type ProfileUpdate = {
  user: User;
  // Whose pending follow requests the save accepted by making the account public; empty
  // for any other save. The caller tells them, once the save has committed.
  accepted: string[];
};

export interface IUserRepository {
  // Create
  create(data: CreateUserDTO): Promise<User>;

  // Read
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  // Account recovery only. The unique indexes are case-sensitive, so ignoring
  // case can match several accounts: callers must handle more than one result.
  findAllByEmailIgnoringCase(email: string): Promise<User[]>;
  findAllByUsernameIgnoringCase(username: string): Promise<User[]>;
  findMany(skip?: number, take?: number): Promise<User[]>;

  // Update. There is deliberately no general `update`: it had no caller left once the
  // profile save moved to updateProfile, and it was a way to make an account public while
  // leaving its follow requests pending. Every privacy change goes through updateProfile.
  // The owner's own profile save. One that sets isPrivate to false also accepts every
  // pending follow request, in the same transaction: a public account has nothing left to
  // approve, and a request must never wait on one.
  updateProfile(id: string, data: UpdateUserDTO): Promise<ProfileUpdate>;
  // Also stamps passwordChangedAt, which invalidates previously issued JWTs,
  // and deletes the user's password reset tokens (outstanding links die too)
  updatePassword(id: string, hashedPassword: string): Promise<User>;
  updateRole(id: string, role: Role): Promise<User>;

  // Delete
  delete(id: string): Promise<User>;

  // Search
  search(query: string, limit?: number, offset?: number): Promise<User[]>;

  // Utility
  exists(email: string, username: string): Promise<boolean>;
  count(): Promise<number>;
}
