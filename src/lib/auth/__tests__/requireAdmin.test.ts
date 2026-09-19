/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/container/container', () => ({
  container: {
    getAuthService: jest.fn(),
    getTokenService: jest.fn(),
  },
}));

import { container } from '@/lib/container/container';
import { isAdminAuthError, requireAdmin } from '../requireAdmin';

function requestWithCookie(token?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/stats', {
    headers: token ? { Cookie: `auth_token=${token}` } : {},
  });
}

describe('requireAdmin', () => {
  const mockAuthService = { validateToken: jest.fn() };
  const admin = { id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'ADMIN' };

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAuthService as jest.Mock).mockReturnValue(mockAuthService);
  });

  it('should return 401 when there is no session cookie', async () => {
    const result = await requireAdmin(requestWithCookie());

    expect(isAdminAuthError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should return the admin identity for a valid admin session', async () => {
    mockAuthService.validateToken.mockResolvedValue(admin);

    const result = await requireAdmin(requestWithCookie('jwt'));

    expect(result).toEqual({
      userId: 'admin-1',
      email: 'admin@example.com',
      username: 'admin',
      role: 'ADMIN',
      isAdmin: true,
    });
  });

  it('should return 401 for an admin session issued before the password changed', async () => {
    // Arrange - validateToken rejects revoked sessions by returning null
    mockAuthService.validateToken.mockResolvedValue(null);

    // Act
    const result = await requireAdmin(requestWithCookie('stolen-admin-jwt'));

    // Assert
    expect((result as NextResponse).status).toBe(401);
  });

  it('should authorize through validateToken and never through a signature-only check', async () => {
    mockAuthService.validateToken.mockResolvedValue(admin);

    await requireAdmin(requestWithCookie('jwt'));

    expect(mockAuthService.validateToken).toHaveBeenCalledWith('jwt');
    expect(container.getTokenService).not.toHaveBeenCalled();
  });

  it('should return 403 when the current role in the database is not ADMIN', async () => {
    mockAuthService.validateToken.mockResolvedValue({ ...admin, role: 'USER' });

    const result = await requireAdmin(requestWithCookie('jwt'));

    expect((result as NextResponse).status).toBe(403);
  });

  it('should return 401 when validation throws', async () => {
    mockAuthService.validateToken.mockRejectedValue(new Error('db down'));

    const result = await requireAdmin(requestWithCookie('jwt'));

    expect((result as NextResponse).status).toBe(401);
  });
});
