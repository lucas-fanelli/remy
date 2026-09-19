/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/container/container', () => ({
  container: {
    getAuthService: jest.fn(),
    getTokenService: jest.fn(),
  },
}));

import { container } from '@/lib/container/container';
import { getCurrentUser, requireAuth, verifySessionToken } from '../auth';

const sessionUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  role: 'USER',
  passwordChangedAt: null,
};

function requestWithCookie(token?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/anything', {
    headers: token ? { Cookie: `auth_token=${token}` } : {},
  });
}

describe('session helpers', () => {
  const mockAuthService = { validateToken: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAuthService as jest.Mock).mockReturnValue(mockAuthService);
  });

  describe('verifySessionToken', () => {
    it('should resolve the identity behind a valid session', async () => {
      // Arrange
      mockAuthService.validateToken.mockResolvedValue(sessionUser);

      // Act
      const identity = await verifySessionToken('jwt');

      // Assert
      expect(identity).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER',
      });
    });

    it('should return null when the auth service rejects the session', async () => {
      // Arrange - e.g. the token was issued before the last password change
      mockAuthService.validateToken.mockResolvedValue(null);

      // Act
      const identity = await verifySessionToken('revoked-jwt');

      // Assert
      expect(identity).toBeNull();
    });

    it('should authorize through validateToken and never through a signature-only check', async () => {
      // Arrange
      mockAuthService.validateToken.mockResolvedValue(sessionUser);

      // Act
      await verifySessionToken('jwt');

      // Assert
      expect(mockAuthService.validateToken).toHaveBeenCalledWith('jwt');
      expect(container.getTokenService).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null without an auth cookie', async () => {
      const user = await getCurrentUser(requestWithCookie());

      expect(user).toBeNull();
      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });

    it('should return the validated user', async () => {
      mockAuthService.validateToken.mockResolvedValue(sessionUser);

      const user = await getCurrentUser(requestWithCookie('jwt'));

      expect(user).toEqual(sessionUser);
    });

    it('should return null when validation throws', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('db down'));

      const user = await getCurrentUser(requestWithCookie('jwt'));

      expect(user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should throw when the session is not valid', async () => {
      mockAuthService.validateToken.mockResolvedValue(null);

      await expect(requireAuth(requestWithCookie('revoked-jwt'))).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should return the user when the session is valid', async () => {
      mockAuthService.validateToken.mockResolvedValue(sessionUser);

      await expect(requireAuth(requestWithCookie('jwt'))).resolves.toEqual(sessionUser);
    });
  });
});
