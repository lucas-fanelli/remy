/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/container/container', () => ({
  container: {
    getTokenService: jest.fn(),
    getRecipeService: jest.fn(),
  },
}));

jest.mock('@/lib/utils/auth', () => ({
  extractAuthToken: jest.fn(),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/cloudinary', () => ({
  deleteFromCloudinary: jest.fn(),
}));

import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { GET as recipeGET, PUT as recipePUT, DELETE as recipeDELETE } from '../recipes/[id]/route';
import { GET as recipesGET, POST as recipesPOST } from '../recipes/route';

const mockTokenService = {
  generate: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockRecipeService = {
  createRecipe: jest.fn(),
  getRecipeById: jest.fn(),
  getUserRecipes: jest.fn(),
  searchRecipes: jest.fn(),
  updateRecipe: jest.fn(),
  deleteRecipe: jest.fn(),
  getRecentRecipes: jest.fn(),
  getRecipesByDifficulty: jest.fn(),
  validateRecipeData: jest.fn(),
};

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function createJsonRequest(url: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function createPutRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'DELETE' });
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

describe('GET /api/recipes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
  });

  it('should return paginated recipes', async () => {
    // Arrange
    const mockRecipes = [
      {
        id: VALID_UUID,
        title: 'Test Recipe',
        description: 'A test recipe',
        imageUrl: 'https://example.com/img.jpg',
        userId: VALID_UUID_2,
        cookingTime: 30,
        prepTime: 10,
        servings: 4,
        difficulty: 'easy',
        ingredients: ['flour', 'sugar'],
        instructions: ['Mix', 'Bake'],
        caption: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        averageRating: 4.5,
        reviewCount: 10,
        user: {
          id: VALID_UUID_2,
          username: 'chef',
          fullName: 'Chef User',
          avatar: null,
        },
        _count: { likes: 5, comments: 3 },
      },
    ];

    (prisma.post.findMany as jest.Mock).mockResolvedValue(mockRecipes);
    (prisma.post.count as jest.Mock).mockResolvedValue(1);

    const request = createGetRequest('http://localhost:3000/api/recipes?limit=20&offset=0');

    // Act
    const response = await recipesGET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].title).toBe('Test Recipe');
    expect(body.recipes[0].author.username).toBe('chef');
    expect(body.recipes[0].averageRating).toBe(4.5);
    expect(body.recipes[0].likeCount).toBe(5);
    expect(body.recipes[0].commentCount).toBe(3);
    expect(body.total).toBe(1);
    expect(body.count).toBe(1);
  });

  it('should return 400 when userId format is invalid', async () => {
    // Arrange
    const request = createGetRequest('http://localhost:3000/api/recipes?userId=not-a-uuid');

    // Act
    const response = await recipesGET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid userId format');
  });
});

describe('POST /api/recipes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getTokenService as jest.Mock).mockReturnValue(mockTokenService);
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
  });

  it('should create a recipe when authenticated', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    const newRecipe = {
      title: 'New Recipe',
      description: 'A new recipe',
      ingredients: ['flour'],
      instructions: ['Mix'],
    };

    const createdRecipe = { id: VALID_UUID_2, ...newRecipe, userId: VALID_UUID };
    mockRecipeService.createRecipe.mockResolvedValue(createdRecipe);

    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      newRecipe,
      'valid-token'
    );

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.recipe).toEqual(createdRecipe);
    expect(body.message).toBe('Recipe created successfully');
    expect(mockRecipeService.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: VALID_UUID, title: 'New Recipe' })
    );
  });

  it('should return 401 when no token is provided', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));

    const request = createJsonRequest('http://localhost:3000/api/recipes', {
      title: 'Recipe',
    });

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 400 when imageUrl has invalid protocol', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    const request = createJsonRequest('http://localhost:3000/api/recipes', {
      title: 'Recipe',
      imageUrl: 'ftp://malicious.com/image.jpg',
    });

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Image must be uploaded through the app');
  });
});

describe('PUT /api/recipes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getTokenService as jest.Mock).mockReturnValue(mockTokenService);
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
  });

  it('should update a recipe when the user is the owner', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    const updatedRecipe = {
      id: VALID_UUID_2,
      title: 'Updated Title',
      userId: VALID_UUID,
    };
    mockRecipeService.updateRecipe.mockResolvedValue(updatedRecipe);

    const request = createPutRequest(`http://localhost:3000/api/recipes/${VALID_UUID_2}`, {
      title: 'Updated Title',
    });

    // Act
    const response = await recipePUT(request, {
      params: Promise.resolve({ id: VALID_UUID_2 }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.recipe).toEqual(updatedRecipe);
    expect(body.message).toBe('Recipe updated successfully');
    expect(mockRecipeService.updateRecipe).toHaveBeenCalledWith(
      VALID_UUID_2,
      VALID_UUID,
      expect.objectContaining({ title: 'Updated Title' })
    );
  });

  it('should return 403 when user is not the recipe owner', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    const { ForbiddenError } = require('@/domain/errors');
    mockRecipeService.updateRecipe.mockRejectedValue(
      new ForbiddenError('You are not authorized to update this recipe')
    );

    const request = createPutRequest(`http://localhost:3000/api/recipes/${VALID_UUID_2}`, {
      title: 'Hacked Title',
    });

    // Act
    const response = await recipePUT(request, {
      params: Promise.resolve({ id: VALID_UUID_2 }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('You do not have permission to update this recipe');
  });
});

describe('DELETE /api/recipes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.getTokenService as jest.Mock).mockReturnValue(mockTokenService);
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
  });

  it('should delete a recipe when the user is the owner', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    mockRecipeService.deleteRecipe.mockResolvedValue({ imageUrl: null });

    const request = createDeleteRequest(`http://localhost:3000/api/recipes/${VALID_UUID_2}`);

    // Act
    const response = await recipeDELETE(request, {
      params: Promise.resolve({ id: VALID_UUID_2 }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.message).toBe('Recipe deleted successfully');
    expect(mockRecipeService.deleteRecipe).toHaveBeenCalledWith(VALID_UUID_2, VALID_UUID);
  });

  it('should return 400 when ID is not a valid UUID', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    const request = createDeleteRequest('http://localhost:3000/api/recipes/not-a-uuid');

    // Act
    const response = await recipeDELETE(request, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid ID format');
  });

  it('should return 403 when user is not the recipe owner', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

    // Service throws typed error atomically
    const { ForbiddenError } = require('@/domain/errors');
    mockRecipeService.deleteRecipe.mockRejectedValue(
      new ForbiddenError('You can only delete your own recipes')
    );

    const request = createDeleteRequest(`http://localhost:3000/api/recipes/${VALID_UUID_2}`);

    // Act
    const response = await recipeDELETE(request, {
      params: Promise.resolve({ id: VALID_UUID_2 }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('You do not have permission to delete this recipe');
  });
});
