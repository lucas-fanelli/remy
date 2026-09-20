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
    $transaction: jest.fn(),
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
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/cloudinary', () => ({
  deleteFromCloudinary: jest.fn(),
}));

import { getCurrentUser, requireAuth } from '@/lib/api/auth';
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
  getRecipeForViewer: jest.fn(),
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
  // CLOUDINARY_CLOUD_NAME is "test-cloud" in .env.test
  const CLOUDINARY_IMAGE = 'https://res.cloudinary.com/test-cloud/image/upload/recipes/cover.jpg';

  const mockTx = {
    $executeRaw: jest.fn(),
    post: { count: jest.fn(), create: jest.fn() },
  };

  const createRecipePayload = (overrides: Record<string, unknown> = {}) => ({
    title: 'New Recipe',
    description: 'A new recipe',
    imageUrl: CLOUDINARY_IMAGE,
    cookingTime: 30,
    prepTime: 10,
    servings: 4,
    difficulty: 'easy',
    ingredients: [{ name: 'flour', amount: '200', unit: 'g' }],
    instructions: [{ step: 1, description: 'Mix' }],
    ...overrides,
  });

  const authenticate = () =>
    (requireAuth as jest.Mock).mockResolvedValue({
      id: VALID_UUID,
      userId: VALID_UUID,
      email: 'test@example.com',
      username: 'testuser',
      role: 'USER',
    });

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getTokenService as jest.Mock).mockReturnValue(mockTokenService);
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
    mockRecipeService.validateRecipeData.mockResolvedValue({ valid: true, errors: [] });
    mockTx.post.count.mockResolvedValue(0);
    mockTx.post.create.mockImplementation(async ({ data }) => ({ id: VALID_UUID_2, ...data }));
    (prisma.$transaction as jest.Mock).mockImplementation(async (run) => run(mockTx));
  });

  it('should create a recipe for the authenticated user', async () => {
    // Arrange
    authenticate();
    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      createRecipePayload(),
      'valid-token'
    );

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.message).toBe('Recipe created successfully');
    expect(body.recipe).toEqual(
      expect.objectContaining({ id: VALID_UUID_2, title: 'New Recipe', userId: VALID_UUID })
    );
  });

  it('should treat an empty step image as "no image"', async () => {
    // Arrange — the recipe forms keep image: '' for steps without a photo
    authenticate();
    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      createRecipePayload({ instructions: [{ step: 1, description: 'Mix', image: '' }] })
    );

    // Act
    const response = await recipesPOST(request);

    // Assert
    expect(response.status).toBe(201);
    expect(mockTx.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ instructions: [{ step: 1, description: 'Mix' }] }),
      })
    );
  });

  it('should reject a client-supplied userId', async () => {
    // Arrange
    authenticate();
    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      createRecipePayload({ userId: VALID_UUID_2 })
    );

    // Act
    const response = await recipesPOST(request);

    // Assert
    expect(response.status).toBe(400);
    expect(mockTx.post.create).not.toHaveBeenCalled();
  });

  it('should return 429 when the daily recipe limit is reached', async () => {
    // Arrange
    authenticate();
    mockTx.post.count.mockResolvedValue(10);
    const request = createJsonRequest('http://localhost:3000/api/recipes', createRecipePayload());

    // Act
    const response = await recipesPOST(request);

    // Assert
    expect(response.status).toBe(429);
    expect(mockTx.post.create).not.toHaveBeenCalled();
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

  it('should return 400 when imageUrl is not a Cloudinary URL', async () => {
    // Arrange
    authenticate();
    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      createRecipePayload({ imageUrl: 'ftp://malicious.com/image.jpg' })
    );

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Image must be a Cloudinary URL');
  });

  it('should return 400 when imageUrl belongs to another Cloudinary account', async () => {
    // Arrange
    authenticate();
    const request = createJsonRequest(
      'http://localhost:3000/api/recipes',
      createRecipePayload({
        imageUrl: 'https://res.cloudinary.com/someone-else/image/upload/x.jpg',
      })
    );

    // Act
    const response = await recipesPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('Image must be uploaded through the app');
  });
});

describe('GET /api/recipes/[id]', () => {
  const recipe = { id: VALID_UUID, title: 'Chocotorta', averageRating: 4.5, totalRatings: 2 };
  const params = Promise.resolve({ id: VALID_UUID });

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getRecipeService as jest.Mock).mockReturnValue(mockRecipeService);
    (getCurrentUser as jest.Mock).mockResolvedValue(null);
  });

  it('should return the recipe when it is public', async () => {
    // Arrange
    mockRecipeService.getRecipeForViewer.mockResolvedValue({ status: 'ok', recipe });

    // Act
    const response = await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), {
      params,
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.recipe.title).toBe('Chocotorta');
  });

  it('should pass the signed-in viewer so the author can read their own recipe', async () => {
    // Arrange
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'author-1' });
    mockRecipeService.getRecipeForViewer.mockResolvedValue({ status: 'ok', recipe });

    // Act
    await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), { params });

    // Assert
    expect(mockRecipeService.getRecipeForViewer).toHaveBeenCalledWith(VALID_UUID, 'author-1');
  });

  it('should pass null for a signed-out visitor', async () => {
    // Arrange
    mockRecipeService.getRecipeForViewer.mockResolvedValue({ status: 'ok', recipe });

    // Act
    await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), { params });

    // Assert
    expect(mockRecipeService.getRecipeForViewer).toHaveBeenCalledWith(VALID_UUID, null);
  });

  // The direct link used to bypass the privacy rule every list endpoint applies
  it('should refuse a recipe whose author keeps a private profile', async () => {
    // Arrange
    mockRecipeService.getRecipeForViewer.mockResolvedValue({ status: 'private' });

    // Act
    const response = await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), {
      params,
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(body.error).toBe('This profile is private');
    expect(body.recipe).toBeUndefined();
  });

  it('should return 404 when the recipe does not exist', async () => {
    // Arrange
    mockRecipeService.getRecipeForViewer.mockResolvedValue({ status: 'notFound' });

    // Act
    const response = await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), {
      params,
    });

    // Assert
    expect(response.status).toBe(404);
  });

  it('should return 400 for a malformed id without asking the service', async () => {
    // Act
    const response = await recipeGET(createGetRequest('http://localhost:3000/api/recipes/x'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });

    // Assert
    expect(response.status).toBe(400);
    expect(mockRecipeService.getRecipeForViewer).not.toHaveBeenCalled();
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
