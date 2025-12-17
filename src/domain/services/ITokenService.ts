export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

// Interface Segregation Principle: Separate interface for token operations
export interface ITokenService {
  generate(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
  decode(token: string): TokenPayload | null;
}
