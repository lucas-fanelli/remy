/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/database/prisma', () => {
  const mockPrisma = {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  return { __esModule: true, default: mockPrisma };
});

jest.mock('@/lib/utils/recipe', () => ({
  safeRating: jest.fn((v: number | null) => v ?? null),
}));

import prisma from '@/lib/database/prisma';
import { GET } from '../recipes/route';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/recipes (search)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not include email fields in the response', async () => {
    const fakeRecipe = {
      id: 'recipe-1',
      title: 'Test Recipe',
      description: 'A test recipe',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
      userId: 'user-1',
      difficulty: 'easy',
      cookingTime: 30,
      prepTime: 15,
      servings: 4,
      ingredients: [],
      instructions: [],
      caption: null,
      averageRating: 4.5,
      reviewCount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        username: 'testuser',
        fullName: 'Test User',
        avatar: null,
        email: 'secret@example.com', // This should NOT appear in the response
      },
      _count: { likes: 5, comments: 3 },
    };

    (mockPrisma.post.findMany as jest.Mock).mockResolvedValue([fakeRecipe]);
    (mockPrisma.post.count as jest.Mock).mockResolvedValue(1);

    const request = createGetRequest('http://localhost:3000/api/recipes?q=test');
    const response = await GET(request);
    const body = await response.json();

    // Verify the response body as a string doesn't contain the email
    const bodyString = JSON.stringify(body);
    expect(bodyString).not.toContain('secret@example.com');
    expect(bodyString).not.toContain('"email"');

    // Verify recipes are returned
    expect(body.recipes).toBeDefined();
    expect(body.recipes.length).toBeGreaterThan(0);
  });
});
