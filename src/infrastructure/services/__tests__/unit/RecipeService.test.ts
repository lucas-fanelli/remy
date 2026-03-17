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
      mockRecipeRepository.updateWhere = jest
        .fn()
        .mockRejectedValue(new Error('Record to update not found'));
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(false);

      await expect(
        recipeService.updateRecipe('non-existent', 'user-123', updateDTO)
      ).rejects.toThrow('Recipe not found');
    });

    it('should throw error when user is not the owner', async () => {
      mockRecipeRepository.updateWhere = jest
        .fn()
        .mockRejectedValue(new Error('Record to update not found'));
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(true);

      await expect(
        recipeService.updateRecipe('recipe-123', 'different-user', updateDTO)
      ).rejects.toThrow('Unauthorized: You can only update your own recipes');
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe successfully when user is owner', async () => {
      mockRecipeRepository.deleteWhere = jest.fn().mockResolvedValue(undefined);

      await recipeService.deleteRecipe('recipe-123', 'user-123');

      expect(mockRecipeRepository.deleteWhere).toHaveBeenCalledWith('recipe-123', 'user-123');
    });

    it('should throw error when recipe not found', async () => {
      mockRecipeRepository.deleteWhere = jest
        .fn()
        .mockRejectedValue(new Error('Record to delete does not exist'));
      mockRecipeRepository.exists = jest.fn().mockResolvedValue(false);

      await expect(recipeService.deleteRecipe('non-existent', 'user-123')).rejects.toThrow(
        'Recipe not found'
      );
    });

    it('should throw error when user is not the owner', async () => {
      mockRecipeRepository.deleteWhere = jest
        .fn()
        .mockRejectedValue(new Error('Record to delete does not exist'));
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
