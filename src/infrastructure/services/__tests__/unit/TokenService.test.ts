import { TokenService } from '../../TokenService';
import { TokenPayload } from '@/domain/services/ITokenService';

describe('TokenService - Unit Tests', () => {
  let tokenService: TokenService;
  const testSecret = 'test-secret-key';
  const testExpiresIn = '1h';

  beforeEach(() => {
    tokenService = new TokenService(testSecret, testExpiresIn);
  });

  describe('generate', () => {
    it('should generate a valid JWT token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for same payload at different times', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token1 = tokenService.generate(payload);
      // Wait 1 second to ensure different iat
      await new Promise(resolve => setTimeout(resolve, 1000));
      const token2 = tokenService.generate(payload);

      // Tokens will be different due to iat (issued at) claim
      expect(token1).not.toBe(token2);
    });

    it('should include all payload data in token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);
      const decoded = tokenService.decode(token);

      expect(decoded).toMatchObject(payload);
    });
  });

  describe('verify', () => {
    it('should verify a valid token', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);
      const verified = tokenService.verify(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.username).toBe(payload.username);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const verified = tokenService.verify(invalidToken);

      expect(verified).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);

      // Create service with different secret
      const differentSecretService = new TokenService('different-secret');
      const verified = differentSecretService.verify(token);

      expect(verified).toBeNull();
    });

    it('should return null for empty token', () => {
      const verified = tokenService.verify('');

      expect(verified).toBeNull();
    });

    it('should return null for malformed token', () => {
      const verified = tokenService.verify('not.a.valid.jwt.token');

      expect(verified).toBeNull();
    });
  });

  describe('decode', () => {
    it('should decode a valid token without verification', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);
      const decoded = tokenService.decode(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.username).toBe(payload.username);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token';
      const decoded = tokenService.decode(invalidToken);

      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = tokenService.decode('');

      expect(decoded).toBeNull();
    });

    it('should decode token even with wrong secret', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = tokenService.generate(payload);

      // Create service with different secret
      const differentSecretService = new TokenService('different-secret');
      const decoded = differentSecretService.decode(token);

      // Decode doesn't verify, so it should still work
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
    });

    it('should handle decode errors gracefully and return null', () => {
      // Mock jwt.decode to throw an error
      const jwt = require('jsonwebtoken');
      const originalDecode = jwt.decode;
      jwt.decode = jest.fn(() => {
        throw new Error('Decode error');
      });

      const decoded = tokenService.decode('some-token');

      expect(decoded).toBeNull();

      // Restore original function
      jwt.decode = originalDecode;
    });
  });

  describe('initialization', () => {
    it('should use default secret from env if not provided', () => {
      const service = new TokenService();
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = service.generate(payload);
      expect(token).toBeDefined();
    });

    it('should use provided secret over env', () => {
      const customSecret = 'custom-secret';
      const service = new TokenService(customSecret);
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = service.generate(payload);
      const verified = service.verify(token);

      expect(verified).toBeDefined();
    });

    // Branch Coverage Tests - Constructor OR operators (lines 10-11)
    it('should use env JWT_SECRET when secret param is undefined - branch coverage', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'env-secret-key';

      const service = new TokenService(undefined, '1h');
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = service.generate(payload);
      const verified = service.verify(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe('user-123');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should use env JWT_EXPIRES_IN when expiresIn param is undefined - branch coverage', () => {
      const originalExpiresIn = process.env.JWT_EXPIRES_IN;
      process.env.JWT_EXPIRES_IN = '24h';

      const service = new TokenService('test-secret', undefined);
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = service.generate(payload);
      const verified = service.verify(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe('user-123');

      process.env.JWT_EXPIRES_IN = originalExpiresIn;
    });

    it('should use default fallback when both param and env are undefined - branch coverage', () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalExpiresIn = process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;

      const service = new TokenService(undefined, undefined);
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = service.generate(payload);
      const verified = service.verify(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe('user-123');

      process.env.JWT_SECRET = originalSecret;
      process.env.JWT_EXPIRES_IN = originalExpiresIn;
    });
  });
});
