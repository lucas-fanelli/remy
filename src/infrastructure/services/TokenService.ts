import jwt from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '@/domain/services/ITokenService';
import { getSessionLifetimeSeconds } from '@/lib/auth/session';

// Single Responsibility Principle: Only handles JWT token operations
export class TokenService implements ITokenService {
  private readonly secret: string;
  private readonly expiresIn?: string;

  constructor(secret?: string, expiresIn?: string) {
    this.secret = secret || process.env.JWT_SECRET || '';
    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable must be configured');
    }
    this.expiresIn = expiresIn;
  }

  generate(payload: TokenPayload): string {
    return jwt.sign(payload as string | object | Buffer, this.secret, {
      // The session lifetime is also the auth cookie's maxAge, so both expire together
      expiresIn: this.expiresIn || getSessionLifetimeSeconds(),
    } as jwt.SignOptions);
  }

  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  decode(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }
}
