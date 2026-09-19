import { User } from '@prisma/client';

export type RegisterDTO = {
  email: string;
  username: string;
  password: string;
  fullName?: string;
};

export type LoginDTO = {
  emailOrUsername: string;
  password: string;
};

// What leaves the auth layer (and reaches the client through /api/auth/me, login
// and register): no password hash, and no passwordChangedAt, which is security
// metadata that only validateToken needs
export type SessionUser = Omit<User, 'password' | 'passwordChangedAt'>;

export type AuthResponse = {
  user: SessionUser;
  token: string;
};

// Interface Segregation Principle: Clean interface for authentication operations
export interface IAuthService {
  register(data: RegisterDTO): Promise<AuthResponse>;
  login(data: LoginDTO): Promise<AuthResponse>;
  validateToken(token: string): Promise<SessionUser | null>;
  /**
   * Changing the password invalidates every session issued before it.
   * Resolves with a fresh token so the caller can keep the current session alive.
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<string>;
}
