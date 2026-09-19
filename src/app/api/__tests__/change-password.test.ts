/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/container/container', () => ({
  container: {
    getAuthService: jest.fn(),
  },
}));

jest.mock('@/lib/utils/cookies', () => ({
  setAuthCookie: jest.fn((response) => response),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logServerError: jest.fn(),
}));

import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { setAuthCookie } from '@/lib/utils/cookies';
import { POST } from '../auth/change-password/route';

function createJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/change-password', () => {
  const mockAuthService = { changePassword: jest.fn() };
  const validBody = { oldPassword: 'OldPassword1', newPassword: 'NewPassword1' };

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAuthService as jest.Mock).mockReturnValue(mockAuthService);
    (requireAuth as jest.Mock).mockResolvedValue({ id: 'user-1' });
  });

  it('should return 200 when the password is changed', async () => {
    // Arrange
    mockAuthService.changePassword.mockResolvedValue('fresh-jwt');

    // Act
    const response = await POST(createJsonRequest(validBody));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: null, message: 'Password changed successfully' });
    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'OldPassword1',
      'NewPassword1'
    );
  });

  it('should re-issue the session cookie so the current session survives the change', async () => {
    // Arrange
    mockAuthService.changePassword.mockResolvedValue('fresh-jwt');

    // Act
    await POST(createJsonRequest(validBody));

    // Assert
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'fresh-jwt');
  });

  it('should not put the fresh token in the response body', async () => {
    // Arrange
    mockAuthService.changePassword.mockResolvedValue('fresh-jwt');

    // Act
    const response = await POST(createJsonRequest(validBody));

    // Assert
    expect(JSON.stringify(await response.json())).not.toContain('fresh-jwt');
  });

  it('should return 401 and leave the cookie alone when not authenticated', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));

    // Act
    const response = await POST(createJsonRequest(validBody));

    // Assert
    expect(response.status).toBe(401);
    expect(setAuthCookie).not.toHaveBeenCalled();
  });

  it('should return 400 when the new password breaks the password rules', async () => {
    // Act
    const response = await POST(createJsonRequest({ oldPassword: 'x', newPassword: 'weak' }));

    // Assert
    expect(response.status).toBe(400);
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('should not re-issue the cookie when the change fails', async () => {
    // Arrange
    mockAuthService.changePassword.mockRejectedValue(new Error('boom'));

    // Act
    const response = await POST(createJsonRequest(validBody));

    // Assert
    expect(response.status).toBe(500);
    expect(setAuthCookie).not.toHaveBeenCalled();
  });
});
