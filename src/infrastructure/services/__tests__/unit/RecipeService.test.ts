jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    meta?: Record<string, unknown>;
    constructor(message: string, { code, clientVersion }: { code: string; clientVersion: string }) {
      super(message);
      this.code = code;
      this.clientVersion = clientVersion;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError,
    },
  };
});

import { Prisma } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import {
  Recipe,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeSearchOptions,
} from '@/domain/types/recipe';
import { RecipeService } from '../../RecipeService';

describe('RecipeService - Unit Tests', () => {
  let recipeService: RecipeService;
  let mockRecipeRepository: IRecipeRepository;

  const mockRecipe: Recipe = {
    id: 'recipe-123',
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validCreateDTO: CreateRecipeDTO = {
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

  beforeEach(() => {
    mockRecipeRepository = mockDeep<IRecipeRepository>();
    recipeService = new RecipeService(mockRecipeRepository);
  });

  describe('createRecipe', () => {
    it('should create a recipe successfully with valid data', async () => {
      mockRecipeRepository.create = jest.fn().mockResolvedValue(mockRecipe);

      const result = await recipeService.createRecipe(validCreateDTO);

      expect(result).toBeDefined();
      expect(result.title).toBe(validCreateDTO.title);
      expect(result.userId).toBe(validCreateDTO.userId);
      expect(mockRecipeRepository.create).toHaveBeenCalledWith(validCreateDTO);
    });

    it('should throw error for missing title', async () => {
      const invalidDTO = { ...validCreateDTO, title: '' };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Recipe validation failed: Title is required'
      );
    });

    it('should throw error for title too long', async () => {
      const invalidDTO = { ...validCreateDTO, title: 'a'.repeat(101) };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Title must be less than 100 characters'
      );
    });

    it('should throw error for missing description', async () => {
      const invalidDTO = { ...validCreateDTO, description: '' };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Description is required'
      );
    });

    it('should throw error for description too long', async () => {
      const invalidDTO = { ...validCreateDTO, description: 'a'.repeat(501) };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Description must be less than 500 characters'
      );
    });

    it('should throw error for missing imageUrl', async () => {
      const invalidDTO = { ...validCreateDTO, imageUrl: '' };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow('Image URL is required');
    });

    it('should throw error for invalid cooking time (zero)', async () => {
      const invalidDTO = { ...validCreateDTO, cookingTime: 0 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Cooking time must be greater than 0'
      );
    });

    it('should throw error for invalid cooking time (negative)', async () => {
      const invalidDTO = { ...validCreateDTO, cookingTime: -10 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Cooking time must be greater than 0'
      );
    });

    it('should throw error for cooking time too long', async () => {
      const invalidDTO = { ...validCreateDTO, cookingTime: 721 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Cooking time must be less than 12 hours (720 minutes)'
      );
    });

    it('should throw error for negative prep time', async () => {
      const invalidDTO = { ...validCreateDTO, prepTime: -5 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Prep time cannot be negative'
      );
    });

    it('should throw error for prep time too long', async () => {
      const invalidDTO = { ...validCreateDTO, prepTime: 481 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Prep time must be less than 8 hours (480 minutes)'
      );
    });

    it('should throw error for invalid servings (zero)', async () => {
      const invalidDTO = { ...validCreateDTO, servings: 0 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Servings must be greater than 0'
      );
    });

    it('should throw error for servings too many', async () => {
      const invalidDTO = { ...validCreateDTO, servings: 101 };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Servings must be less than 100'
      );
    });

    it('should throw error for invalid difficulty', async () => {
      const invalidDTO = { ...validCreateDTO, difficulty: 'super-hard' as any };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Difficulty must be easy, medium, or hard'
      );
    });

    it('should throw error for empty ingredients array', async () => {
      const invalidDTO = { ...validCreateDTO, ingredients: [] };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'At least one ingredient is required'
      );
    });

    it('should throw error for ingredient missing name', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        ingredients: [{ name: '', amount: '2', unit: 'pieces' }],
      };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Ingredient 1: name is required'
      );
    });

    it('should throw error for ingredient missing amount when unit is not "to taste"', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        ingredients: [{ name: 'Tomato', amount: '', unit: 'pieces' }],
      };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Ingredient 1: amount is required'
      );
    });

    it('should allow ingredient with empty amount when unit is "to taste"', async () => {
      const validDTO = {
        ...validCreateDTO,
        ingredients: [
          { name: 'Salt', amount: '', unit: 'to taste' },
          { name: 'Tomato', amount: '2', unit: 'pieces' },
        ],
      };

      mockRecipeRepository.create = jest.fn().mockResolvedValue({
        ...mockRecipe,
        ingredients: validDTO.ingredients,
      });

      const result = await recipeService.createRecipe(validDTO);

      expect(result).toBeDefined();
      expect(mockRecipeRepository.create).toHaveBeenCalledWith(validDTO);
    });

    it('should throw error for ingredient missing unit', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        ingredients: [{ name: 'Tomato', amount: '2', unit: '' }],
      };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Ingredient 1: unit is required'
      );
    });

    it('should throw error for empty instructions array', async () => {
      const invalidDTO = { ...validCreateDTO, instructions: [] };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'At least one instruction step is required'
      );
    });

    it('should throw error for instruction missing description', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        instructions: [{ step: 1, description: '' }],
      };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Instruction 1: description is required'
      );
    });

    it('should throw error for instruction step number mismatch', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        instructions: [
          { step: 1, description: 'First step' },
          { step: 3, description: 'Wrong step number' },
        ],
      };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Instruction 2: step number must match position'
      );
    });
  });

  describe('getRecipeById', () => {
    it('should return recipe when found', async () => {
      mockRecipeRepository.findById = jest.fn().mockResolvedValue(mockRecipe);

      const result = await recipeService.getRecipeById('recipe-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('recipe-123');
      expect(mockRecipeRepository.findById).toHaveBeenCalledWith('recipe-123');
    });

    it('should return null when recipe not found', async () => {
      mockRecipeRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await recipeService.getRecipeById('non-existent');

      expect(result).toBeNull();
      expect(mockRecipeRepository.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  // Who may read it is decided before this is called — GET /api/recipes/[id] asks
  // canSeePost, as every door reached through a recipe id does. The service used to keep a
  // copy of that rule, one that could not have known about followers.
  describe('getRecipeWithCounts', () => {
    const counts = { likes: 3, comments: 2 };

    it('should return the recipe with its counts', async () => {
      mockRecipeRepository.findByIdWithAuthor = jest
        .fn()
        .mockResolvedValue({ recipe: mockRecipe, author: { id: 'a', isPrivate: true }, counts });

      const result = await recipeService.getRecipeWithCounts('recipe-123');

      expect(result).toEqual({ recipe: mockRecipe, counts });
    });

    it('should return null for a recipe that does not exist', async () => {
      mockRecipeRepository.findByIdWithAuthor = jest.fn().mockResolvedValue(null);

      expect(await recipeService.getRecipeWithCounts('non-existent')).toBeNull();
    });
  });

  describe('getUserRecipes', () => {
    it('should return user recipes with default pagination', async () => {
      const recipes = [mockRecipe];
      mockRecipeRepository.findByUserId = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.getUserRecipes('user-123');

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.findByUserId).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined
      );
    });

    it('should return user recipes with custom pagination', async () => {
      const recipes = [mockRecipe];
      mockRecipeRepository.findByUserId = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.getUserRecipes('user-123', 10, 20);

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.findByUserId).toHaveBeenCalledWith('user-123', 10, 20);
    });
  });

  describe('searchRecipes', () => {
    it('should search recipes with options', async () => {
      const recipes = [mockRecipe];
      const searchOptions: RecipeSearchOptions = {
        query: 'pasta',
        filters: { difficulty: 'easy' },
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      mockRecipeRepository.search = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.searchRecipes(searchOptions);

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.search).toHaveBeenCalledWith(searchOptions);
    });
  });

  describe('updateRecipe', () => {
    const updateDTO: UpdateRecipeDTO = {
      title: 'Updated Recipe',
      description: 'Updated description',
    };

    it('should update recipe successfully when user is owner', async () => {
      const updatedRecipe = { ...mockRecipe, ...updateDTO };
      mockRecipeRepository.updateWhere = jest.fn().mockResolvedValue(updatedRecipe);

      const result = await recipeService.updateRecipe('recipe-123', 'user-123', updateDTO);

      expect(result.title).toBe('Updated Recipe');
      expect(mockRecipeRepository.updateWhere).toHaveBeenCalledWith(
        'recipe-123',
        'user-123',
        updateDTO
      );
    });

    it('should throw error when recipe not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockRecipeRepository.updateWhere = jest.fn().mockRejectedValue(prismaError);
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(false);

      await expect(
        recipeService.updateRecipe('non-existent', 'user-123', updateDTO)
      ).rejects.toThrow('Recipe not found');
    });

    it('should throw error when user is not the owner', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockRecipeRepository.updateWhere = jest.fn().mockRejectedValue(prismaError);
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(true);

      await expect(
        recipeService.updateRecipe('recipe-123', 'different-user', updateDTO)
      ).rejects.toThrow('Unauthorized: You can only update your own recipes');
    });

    it('should rethrow unexpected repository errors untouched', async () => {
      mockRecipeRepository.updateWhere = jest.fn().mockRejectedValue(new Error('connection lost'));

      await expect(recipeService.updateRecipe('recipe-123', 'user-123', updateDTO)).rejects.toThrow(
        'connection lost'
      );
    });

    it('should strip HTML from every text field before saving', async () => {
      mockRecipeRepository.updateWhere = jest.fn().mockResolvedValue(mockRecipe);

      await recipeService.updateRecipe('recipe-123', 'user-123', {
        title: '<b>Pasta</b>',
        description: '<script>alert(1)</script>Rich',
        caption: '<i>Yum</i>',
        ingredients: [{ name: '<u>Tomato</u>', amount: '2', unit: 'pieces' }],
        instructions: [{ step: 1, description: '<p>Boil water</p>' }],
      });

      expect(mockRecipeRepository.updateWhere).toHaveBeenCalledWith('recipe-123', 'user-123', {
        title: 'Pasta',
        description: 'alert(1)Rich',
        caption: 'Yum',
        ingredients: [{ name: 'Tomato', amount: '2', unit: 'pieces' }],
        instructions: [{ step: 1, description: 'Boil water' }],
      });
    });

    it('should accept a partial update that only changes numeric fields', async () => {
      mockRecipeRepository.updateWhere = jest.fn().mockResolvedValue(mockRecipe);
      const partial: UpdateRecipeDTO = { cookingTime: 720, prepTime: 0, servings: 100 };

      await recipeService.updateRecipe('recipe-123', 'user-123', partial);

      expect(mockRecipeRepository.updateWhere).toHaveBeenCalledWith(
        'recipe-123',
        'user-123',
        partial
      );
    });

    it('should accept an ingredient without amount when its unit is "to taste"', async () => {
      mockRecipeRepository.updateWhere = jest.fn().mockResolvedValue(mockRecipe);

      await expect(
        recipeService.updateRecipe('recipe-123', 'user-123', {
          ingredients: [{ name: 'Salt', amount: '', unit: 'to taste' }],
        })
      ).resolves.toBeDefined();
    });

    const step = (n: number, description = 'Do it') => ({ step: n, description });
    const ingredient = (overrides = {}) => ({ name: 'Salt', amount: '1', unit: 'g', ...overrides });

    it.each<[string, UpdateRecipeDTO, string]>([
      ['a blank title', { title: '   ' }, 'Title is required'],
      ['a title over 100 characters', { title: 'a'.repeat(101) }, 'Title must be less than 100'],
      ['a blank description', { description: '  ' }, 'Description is required'],
      [
        'a description over 500 characters',
        { description: 'a'.repeat(501) },
        'Description must be less than 500',
      ],
      ['a cooking time of zero', { cookingTime: 0 }, 'Cooking time must be greater than 0'],
      ['a cooking time over 12 hours', { cookingTime: 721 }, 'Cooking time must be less than 12'],
      ['a negative prep time', { prepTime: -1 }, 'Prep time cannot be negative'],
      ['a prep time over 8 hours', { prepTime: 481 }, 'Prep time must be less than 8 hours'],
      ['zero servings', { servings: 0 }, 'Servings must be greater than 0'],
      ['more than 100 servings', { servings: 101 }, 'Servings must be less than 100'],
      [
        'an unknown difficulty',
        { difficulty: 'expert' as UpdateRecipeDTO['difficulty'] },
        'Difficulty must be easy, medium, or hard',
      ],
      ['an empty ingredient list', { ingredients: [] }, 'At least one ingredient is required'],
      [
        'more than 100 ingredients',
        { ingredients: Array.from({ length: 101 }, () => ingredient()) },
        'Maximum 100 ingredients',
      ],
      [
        'an ingredient without a name',
        { ingredients: [ingredient({ name: ' ' })] },
        'Ingredient 1: name is required',
      ],
      [
        'an ingredient without an amount',
        { ingredients: [ingredient({ amount: '' })] },
        'Ingredient 1: amount is required',
      ],
      [
        'an ingredient without a unit',
        { ingredients: [ingredient({ unit: '' })] },
        'Ingredient 1: unit is required',
      ],
      ['an empty step list', { instructions: [] }, 'At least one instruction step is required'],
      [
        'more than 50 steps',
        { instructions: Array.from({ length: 51 }, (_, i) => step(i + 1)) },
        'Maximum 50 steps',
      ],
      [
        'a step without a description',
        { instructions: [step(1, ' ')] },
        'Instruction 1: description is required',
      ],
      [
        'step numbers that skip a position',
        { instructions: [step(1), step(3)] },
        'Instruction 2: step number must match position',
      ],
    ])('should reject %s without touching the repository', async (_case, data, message) => {
      mockRecipeRepository.updateWhere = jest.fn();

      await expect(recipeService.updateRecipe('recipe-123', 'user-123', data)).rejects.toThrow(
        message
      );
      expect(mockRecipeRepository.updateWhere).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe successfully when user is owner', async () => {
      mockRecipeRepository.deleteWhere = jest.fn().mockResolvedValue(undefined);

      await recipeService.deleteRecipe('recipe-123', 'user-123');

      expect(mockRecipeRepository.deleteWhere).toHaveBeenCalledWith('recipe-123', 'user-123');
    });

    it('should throw error when recipe not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist',
        { code: 'P2025', clientVersion: '5.0.0' }
      );
      mockRecipeRepository.deleteWhere = jest.fn().mockRejectedValue(prismaError);
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(false);

      await expect(recipeService.deleteRecipe('non-existent', 'user-123')).rejects.toThrow(
        'Recipe not found'
      );
    });

    it('should rethrow unexpected repository errors untouched', async () => {
      mockRecipeRepository.deleteWhere = jest.fn().mockRejectedValue(new Error('connection lost'));

      await expect(recipeService.deleteRecipe('recipe-123', 'user-123')).rejects.toThrow(
        'connection lost'
      );
    });

    it('should throw error when user is not the owner', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist',
        { code: 'P2025', clientVersion: '5.0.0' }
      );
      mockRecipeRepository.deleteWhere = jest.fn().mockRejectedValue(prismaError);
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(true);

      await expect(recipeService.deleteRecipe('recipe-123', 'different-user')).rejects.toThrow(
        'Unauthorized: You can only delete your own recipes'
      );
    });
  });

  describe('getRecentRecipes', () => {
    it('should return recent recipes with default pagination', async () => {
      const recipes = [mockRecipe];
      mockRecipeRepository.getRecent = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.getRecentRecipes();

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.getRecent).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should return recent recipes with custom pagination', async () => {
      const recipes = [mockRecipe];
      mockRecipeRepository.getRecent = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.getRecentRecipes(10, 20);

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.getRecent).toHaveBeenCalledWith(10, 20);
    });
  });

  describe('getRecipesByDifficulty', () => {
    it('should return recipes by difficulty', async () => {
      const recipes = [mockRecipe];
      mockRecipeRepository.getByDifficulty = jest.fn().mockResolvedValue(recipes);

      const result = await recipeService.getRecipesByDifficulty('easy', 10, 0);

      expect(result).toEqual(recipes);
      expect(mockRecipeRepository.getByDifficulty).toHaveBeenCalledWith('easy', 10, 0);
    });
  });

  describe('validateRecipeData', () => {
    it('should return valid for correct recipe data', async () => {
      const result = await recipeService.validateRecipeData(validCreateDTO);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return multiple errors for invalid data', async () => {
      const invalidDTO = {
        ...validCreateDTO,
        title: '',
        description: '',
        cookingTime: 0,
        servings: 0,
        difficulty: 'invalid' as any,
        ingredients: [],
        instructions: [],
      };

      const result = await recipeService.validateRecipeData(invalidDTO);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('Description is required');
      expect(result.errors).toContain('Cooking time must be greater than 0');
    });
  });
});
