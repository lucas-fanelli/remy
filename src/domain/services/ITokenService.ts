export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  // Standard JWT claims, in SECONDS since the epoch. Set by the token service
  // when signing; present on every verified payload.
  iat?: number;
  exp?: number;
}

// Interface Segregation Principle: Separate interface for token operations
export interface ITokenService {
  generate(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
  decode(token: string): TokenPayload | null;
}
