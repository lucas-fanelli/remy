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

export type ValidatedSession = {
  user: SessionUser;
  // Fresh token when the presented one is past the renewal threshold, otherwise null
  renewedToken: string | null;
};

// Interface Segregation Principle: Clean interface for authentication operations
export interface IAuthService {
  register(data: RegisterDTO): Promise<AuthResponse>;
  login(data: LoginDTO): Promise<AuthResponse>;
  validateToken(token: string): Promise<SessionUser | null>;
  /**
   * validateToken plus sliding renewal: same rejections (bad signature, expired,
   * unknown user, issued before a password change), and a token that passes them
   * and is old enough comes back with a replacement carrying the user's CURRENT role.
   */
  validateSession(token: string): Promise<ValidatedSession | null>;
  /**
   * Changing the password invalidates every session issued before it.
   * Resolves with a fresh token so the caller can keep the current session alive.
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<string>;
}
