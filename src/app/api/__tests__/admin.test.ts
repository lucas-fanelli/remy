/**
 * @jest-environment node
 */
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: { count: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

jest.mock('@/lib/container/container', () => ({
  container: {
    getTokenService: jest.fn(),
    getAdminService: jest.fn(),
  },
}));

jest.mock('@/lib/utils/auth', () => ({
  extractAuthToken: jest.fn(),
}));

jest.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: jest.fn(),
  isAdminAuthError: jest.fn(),
}));

jest.mock('@/lib/cloudinary', () => ({
  deleteFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { DELETE as deleteComment } from '../admin/comments/[id]/route';
import { POST as recalcRatings } from '../admin/recalc-ratings/route';
import { DELETE as deleteRecipe } from '../admin/recipes/[id]/route';

const mockAdminService = {
  getAllUsers: jest.fn(),
  promoteToAdmin: jest.fn(),
  demoteToUser: jest.fn(),
  deleteUser: jest.fn(),
  getAllRecipes: jest.fn(),
  deleteRecipe: jest.fn(),
  getAllComments: jest.fn(),
  deleteComment: jest.fn(),
  getStats: jest.fn(),
};

function createDeleteRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer admin-token' },
  });
}

function createPostRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
  });
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const mockAdminAuth = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
  isAdmin: true,
};

describe('DELETE /api/admin/comments/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAdminService as jest.Mock).mockReturnValue(mockAdminService);
  });

  it('should delete a comment when user is admin', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    mockAdminService.deleteComment.mockResolvedValue(undefined);

    const request = createDeleteRequest(`http://localhost:3000/api/admin/comments/${VALID_UUID}`);

    // Act
    const response = await deleteComment(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.message).toBe('Comment deleted successfully');
    expect(mockAdminService.deleteComment).toHaveBeenCalledWith(VALID_UUID);
  });

  it('should return 403 when user is not admin', async () => {
    // Arrange
    const forbiddenResponse = NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
    (requireAdmin as jest.Mock).mockResolvedValue(forbiddenResponse);
    (isAdminAuthError as jest.Mock).mockReturnValue(true);

    const request = createDeleteRequest(`http://localhost:3000/api/admin/comments/${VALID_UUID}`);

    // Act
    const response = await deleteComment(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('Admin access required');
    expect(mockAdminService.deleteComment).not.toHaveBeenCalled();
  });

  it('should return 401 when no token is provided', async () => {
    // Arrange
    const unauthorizedResponse = NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
    (requireAdmin as jest.Mock).mockResolvedValue(unauthorizedResponse);
    (isAdminAuthError as jest.Mock).mockReturnValue(true);

    const request = createDeleteRequest(`http://localhost:3000/api/admin/comments/${VALID_UUID}`);

    // Act
    const response = await deleteComment(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('should return 400 when comment ID is not a valid UUID', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);

    const request = createDeleteRequest('http://localhost:3000/api/admin/comments/bad-id');

    // Act
    const response = await deleteComment(request, {
      params: Promise.resolve({ id: 'bad-id' }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid ID format');
  });

  it('should return 404 when comment does not exist', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    mockAdminService.deleteComment.mockRejectedValue(new Error('COMMENT_NOT_FOUND'));

    const request = createDeleteRequest(`http://localhost:3000/api/admin/comments/${VALID_UUID}`);

    // Act
    const response = await deleteComment(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(body.error).toBe('Comment not found');
  });
});

describe('DELETE /api/admin/recipes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAdminService as jest.Mock).mockReturnValue(mockAdminService);
  });

  it('should delete a recipe when user is admin', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    mockAdminService.deleteRecipe.mockResolvedValue({ imageUrl: null });

    const request = createDeleteRequest(`http://localhost:3000/api/admin/recipes/${VALID_UUID}`);

    // Act
    const response = await deleteRecipe(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.message).toBe('Recipe deleted successfully');
    expect(mockAdminService.deleteRecipe).toHaveBeenCalledWith(VALID_UUID);
  });

  it('should return 403 when user is not admin', async () => {
    // Arrange
    const forbiddenResponse = NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
    (requireAdmin as jest.Mock).mockResolvedValue(forbiddenResponse);
    (isAdminAuthError as jest.Mock).mockReturnValue(true);

    const request = createDeleteRequest(`http://localhost:3000/api/admin/recipes/${VALID_UUID}`);

    // Act
    const response = await deleteRecipe(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('Admin access required');
    expect(mockAdminService.deleteRecipe).not.toHaveBeenCalled();
  });

  it('should return 404 when recipe does not exist', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record to delete does not exist',
      { code: 'P2025', clientVersion: '5.0.0' }
    );
    mockAdminService.deleteRecipe.mockRejectedValue(prismaError);

    const request = createDeleteRequest(`http://localhost:3000/api/admin/recipes/${VALID_UUID}`);

    // Act
    const response = await deleteRecipe(request, {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(body.error).toBe('Recipe not found');
  });
});

describe('POST /api/admin/recalc-ratings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should recalculate ratings when user is admin', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    // Transaction callback receives tx and returns count (count is inside transaction now)
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (...args: unknown[]) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(0),
          post: { count: jest.fn().mockResolvedValue(42) },
        };
        return fn(tx);
      }
    );

    const request = createPostRequest('http://localhost:3000/api/admin/recalc-ratings');

    // Act
    const response = await recalcRatings(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Recalculated ratings');
    expect(body.total).toBe(42);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should return 403 when user is not admin', async () => {
    // Arrange
    const forbiddenResponse = NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
    (requireAdmin as jest.Mock).mockResolvedValue(forbiddenResponse);
    (isAdminAuthError as jest.Mock).mockReturnValue(true);

    const request = createPostRequest('http://localhost:3000/api/admin/recalc-ratings');

    // Act
    const response = await recalcRatings(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('Admin access required');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should return 500 when transaction fails', async () => {
    // Arrange
    (requireAdmin as jest.Mock).mockResolvedValue(mockAdminAuth);
    (isAdminAuthError as jest.Mock).mockReturnValue(false);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = createPostRequest('http://localhost:3000/api/admin/recalc-ratings');

    // Act
    const response = await recalcRatings(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Database error');
  });
});
