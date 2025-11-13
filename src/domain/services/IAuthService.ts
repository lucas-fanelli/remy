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

export type AuthResponse = {
  user: Omit<User, 'password'>;
  token: string;
};

// Interface Segregation Principle: Clean interface for authentication operations
export interface IAuthService {
  register(data: RegisterDTO): Promise<AuthResponse>;
  login(data: LoginDTO): Promise<AuthResponse>;
  validateToken(token: string): Promise<Omit<User, 'password'> | null>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
