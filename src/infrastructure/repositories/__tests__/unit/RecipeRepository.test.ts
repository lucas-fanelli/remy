import { PrismaClient, Post } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CreateRecipeDTO, UpdateRecipeDTO, RecipeSearchOptions } from '@/domain/types/recipe';
import { RecipeRepository } from '../../RecipeRepository';

describe('RecipeRepository - Unit Tests', () => {
  let recipeRepository: RecipeRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

  const mockPost: Post = {
    id: 'recipe-123',
    title: 'Test Recipe',
    description: 'A delicious test recipe',
    imageUrl: 'https://example.com/image.jpg',
    caption: 'Delicious homemade pasta',
    userId: 'user-123',
    cookingTime: 30,
    prepTime: 15,
    servings: 4,
    difficulty: 'easy',
    ingredients: [
      { name: 'Tomato', amount: '2', unit: 'pieces' },
      { name: 'Pasta', amount: '200', unit: 'grams' },
    ] as any,
    instructions: [
      { step: 1, description: 'Boil water' },
      { step: 2, description: 'Cook pasta' },
    ] as any,
    dietaryTags: [],
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const authorInclude = {
    include: {
      user: {
        select: {
          username: true,
          fullName: true,
          avatar: true,
        },
      },
    },
  };

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    recipeRepository = new RecipeRepository(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new recipe', async () => {
      const createData: CreateRecipeDTO = {
        title: 'Test Recipe',
        description: 'A delicious test recipe',
        imageUrl: 'https://example.com/image.jpg',
        userId: 'user-123',
        cookingTime: 30,
        prepTime: 15,
        servings: 4,
        difficulty: 'easy',
        ingredients: [
          { name: 'Tomato', amount: '2', unit: 'pieces' },
          { name: 'Pasta', amount: '200', unit: 'grams' },
        ],
        instructions: [
          { step: 1, description: 'Boil water' },
          { step: 2, description: 'Cook pasta' },
        ],
        caption: 'Delicious homemade pasta',
      };

      prismaMock.post.create.mockResolvedValue(mockPost);

      const result = await recipeRepository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('recipe-123');
      expect(result.title).toBe('Test Recipe');
      expect(result.userId).toBe('user-123');
      expect(prismaMock.post.create).toHaveBeenCalledWith({
        data: {
          title: createData.title,
          description: createData.description,
          imageUrl: createData.imageUrl,
          userId: createData.userId,
          caption: createData.caption,
          cookingTime: createData.cookingTime,
          prepTime: createData.prepTime,
          servings: createData.servings,
          difficulty: createData.difficulty,
          ingredients: createData.ingredients,
          instructions: createData.instructions,
        },
      });
    });
  });

  describe('findById', () => {
    it('should find recipe by id', async () => {
      prismaMock.post.findUnique.mockResolvedValue(mockPost);

      const result = await recipeRepository.findById('recipe-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('recipe-123');
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 'recipe-123' },
        include: {
          user: {
            select: {
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      });
    });

    it('should return null when recipe not found', async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);

      const result = await recipeRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find recipes by user id with default pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.findByUserId('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should find recipes by user id with custom pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.findByUserId('user-123', 10, 5);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('search', () => {
    it('should search recipes with query', async () => {
      const searchOptions: RecipeSearchOptions = {
        query: 'pasta',
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'pasta', mode: 'insensitive' } },
            { description: { contains: 'pasta', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with difficulty filter', async () => {
      const searchOptions: RecipeSearchOptions = {
        filters: { difficulty: 'easy' },
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { difficulty: 'easy' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with maxCookingTime filter', async () => {
      const searchOptions: RecipeSearchOptions = {
        filters: { maxCookingTime: 60 },
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { cookingTime: { lte: 60 } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with maxPrepTime filter', async () => {
      const searchOptions: RecipeSearchOptions = {
        filters: { maxPrepTime: 30 },
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { prepTime: { lte: 30 } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with userId filter', async () => {
      const searchOptions: RecipeSearchOptions = {
        filters: { userId: 'user-123' },
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with custom limit and offset', async () => {
      const searchOptions: RecipeSearchOptions = {
        limit: 10,
        offset: 5,
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
        ...authorInclude,
      });
    });

    it('should search recipes with custom sortBy and sortOrder', async () => {
      const searchOptions: RecipeSearchOptions = {
        sortBy: 'likes',
        sortOrder: 'asc',
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { likes: 'asc' },
        take: 20,
        skip: 0,
        ...authorInclude,
      });
    });

    it('should search recipes with all filters combined', async () => {
      const searchOptions: RecipeSearchOptions = {
        query: 'pasta',
        filters: {
          difficulty: 'easy',
          maxCookingTime: 60,
          maxPrepTime: 30,
          userId: 'user-123',
        },
        limit: 10,
        offset: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.search(searchOptions);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'pasta', mode: 'insensitive' } },
            { description: { contains: 'pasta', mode: 'insensitive' } },
          ],
          difficulty: 'easy',
          cookingTime: { lte: 60 },
          prepTime: { lte: 30 },
          userId: 'user-123',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
        ...authorInclude,
      });
    });
  });

  describe('update', () => {
    it('should update a recipe', async () => {
      const updateData: UpdateRecipeDTO = {
        title: 'Updated Recipe',
        description: 'Updated description',
      };

      const updatedPost = { ...mockPost, ...updateData } as any;
      prismaMock.post.update.mockResolvedValue(updatedPost);

      const result = await recipeRepository.update('recipe-123', updateData);

      expect(result.title).toBe('Updated Recipe');
      expect(result.description).toBe('Updated description');
      expect(prismaMock.post.update).toHaveBeenCalledWith({
        where: { id: 'recipe-123' },
        data: {
          title: updateData.title,
          description: updateData.description,
          imageUrl: undefined,
          caption: undefined,
          cookingTime: undefined,
          prepTime: undefined,
          servings: undefined,
          difficulty: undefined,
          ingredients: undefined,
          instructions: undefined,
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete a recipe', async () => {
      prismaMock.post.delete.mockResolvedValue(mockPost);

      await recipeRepository.delete('recipe-123');

      expect(prismaMock.post.delete).toHaveBeenCalledWith({
        where: { id: 'recipe-123' },
      });
    });
  });

  describe('getRecent', () => {
    it('should get recent recipes with default pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.getRecent();

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should get recent recipes with custom pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.getRecent(10, 5);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('getByDifficulty', () => {
    it('should get recipes by difficulty with default pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.getByDifficulty('easy');

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { difficulty: 'easy' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should get recipes by difficulty with custom pagination', async () => {
      prismaMock.post.findMany.mockResolvedValue([mockPost]);

      const result = await recipeRepository.getByDifficulty('hard', 10, 5);

      expect(result).toHaveLength(1);
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: { difficulty: 'hard' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('exists', () => {
    it('should return true when recipe exists', async () => {
      prismaMock.post.count.mockResolvedValue(1);

      const result = await recipeRepository.exists('recipe-123');

      expect(result).toBe(true);
      expect(prismaMock.post.count).toHaveBeenCalledWith({
        where: { id: 'recipe-123' },
      });
    });

    it('should return false when recipe does not exist', async () => {
      prismaMock.post.count.mockResolvedValue(0);

      const result = await recipeRepository.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total count of recipes', async () => {
      prismaMock.post.count.mockResolvedValue(42);

      const result = await recipeRepository.count();

      expect(result).toBe(42);
      expect(prismaMock.post.count).toHaveBeenCalled();
    });
  });

  describe('countByUser', () => {
    it('should return count of recipes by user', async () => {
      prismaMock.post.count.mockResolvedValue(10);

      const result = await recipeRepository.countByUser('user-123');

      expect(result).toBe(10);
      expect(prismaMock.post.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('mapToRecipe (private method testing via public methods)', () => {
    it('should handle null values in post data', async () => {
      const postWithNulls: Post = {
        ...mockPost,
        title: null as any,
        description: null as any,
        caption: null,
        cookingTime: null as any,
        prepTime: null as any,
        servings: null as any,
        difficulty: null as any,
        ingredients: null as any,
        instructions: null as any,
      };

      prismaMock.post.findUnique.mockResolvedValue(postWithNulls);

      const result = await recipeRepository.findById('recipe-123');

      expect(result).toBeDefined();
      expect(result?.title).toBe('');
      expect(result?.description).toBe('');
      expect(result?.cookingTime).toBe(0);
      expect(result?.prepTime).toBe(0);
      expect(result?.servings).toBe(0);
      expect(result?.difficulty).toBe('medium');
      expect(result?.ingredients).toEqual([]);
      expect(result?.instructions).toEqual([]);
      expect(result?.caption).toBeUndefined();
    });

    it('should handle undefined user in post data - lines 205-208', async () => {
      const postWithoutUser = { ...mockPost, user: undefined };

      prismaMock.post.findUnique.mockResolvedValue(postWithoutUser as any);

      const result = await recipeRepository.findById('recipe-123');

      expect(result).toBeDefined();
      expect(result?.author).toBeUndefined();
    });
  });

  describe('getRecent with undefined user', () => {
    it('should handle undefined user in getRecent - lines 205-208', async () => {
      const postWithoutUser = { ...mockPost, user: undefined };
      prismaMock.post.findMany.mockResolvedValue([postWithoutUser as any]);

      const result = await recipeRepository.getRecent();

      expect(result).toHaveLength(1);
      expect(result[0].author).toBeUndefined();
    });
  });

  describe('search with undefined user', () => {
    it('should handle undefined user in search - lines 205-208', async () => {
      const postWithoutUser = { ...mockPost, user: undefined };
      prismaMock.post.findMany.mockResolvedValue([postWithoutUser as any]);

      const result = await recipeRepository.search({ query: 'test' });

      expect(result).toHaveLength(1);
      expect(result[0].author).toBeUndefined();
    });
  });
});
