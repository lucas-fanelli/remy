import { IngredientMatchService } from '../../IngredientMatchService';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { Recipe } from '@/domain/types/recipe';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('IngredientMatchService', () => {
  let service: IngredientMatchService;
  let mockRecipeRepository: DeepMockProxy<IRecipeRepository>;

  const mockRecipe: Recipe = {
    id: '1',
    title: 'Chicken Pasta',
    description: 'Delicious pasta',
    imageUrl: 'image.jpg',
    userId: 'user1',
    cookingTime: 30,
    prepTime: 15,
    servings: 4,
    difficulty: 'medium',
    cuisine: 'Italian',
    ingredients: [
      { name: 'chicken breast', amount: '2', unit: 'pieces' },
      { name: 'pasta', amount: '500', unit: 'g' },
      { name: 'tomato sauce', amount: '1', unit: 'cup' },
      { name: 'garlic', amount: '3', unit: 'cloves' },
      { name: 'olive oil', amount: '2', unit: 'tbsp' },
    ],
    instructions: [
      { step: 1, description: 'Cook pasta' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRecipeRepository = mockDeep<IRecipeRepository>();
    service = new IngredientMatchService(mockRecipeRepository);
  });

  describe('calculateMatchPercentage', () => {
    it('should return 100% for perfect match', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato'];
      const userIngredients = ['chicken', 'pasta', 'tomato'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should return 50% for half match', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato', 'garlic'];
      const userIngredients = ['chicken', 'pasta'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(50);
    });

    it('should return 0% for no match', () => {
      const recipeIngredients = ['chicken', 'pasta'];
      const userIngredients = ['beef', 'rice'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(0);
    });

    it('should handle empty recipe ingredients', () => {
      const recipeIngredients: string[] = [];
      const userIngredients = ['chicken', 'pasta'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(0);
    });

    it('should match with case insensitivity', () => {
      const recipeIngredients = ['Chicken', 'PASTA', 'Tomato'];
      const userIngredients = ['chicken', 'pasta', 'tomato'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match plural and singular forms', () => {
      const recipeIngredients = ['tomato', 'potato', 'berry'];
      const userIngredients = ['tomatoes', 'potatoes', 'berries'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match simple plural forms with "s"', () => {
      const recipeIngredients = ['carrot', 'apple'];
      const userIngredients = ['carrots', 'apples'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match "es" plural forms', () => {
      const recipeIngredients = ['potato', 'tomato'];
      const userIngredients = ['potatoes', 'tomatoes'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match "ies" plural forms (y -> ies)', () => {
      const recipeIngredients = ['berry', 'cherry'];
      const userIngredients = ['berries', 'cherries'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match reverse "ies" plural forms (berries -> berry)', () => {
      const recipeIngredients = ['berries', 'cherries'];
      const userIngredients = ['berry', 'cherry'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should ignore common descriptors (fresh, dried, etc.)', () => {
      const recipeIngredients = ['fresh basil', 'dried oregano', 'chopped onion'];
      const userIngredients = ['basil', 'oregano', 'onion'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100);
    });

    it('should match compound ingredients', () => {
      const recipeIngredients = ['chicken breast', 'olive oil'];
      const userIngredients = ['chicken', 'olive oil'];

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(100); // "chicken breast" contains "chicken"
    });

    it('should round percentage correctly', () => {
      const recipeIngredients = ['a', 'b', 'c']; // 3 ingredients
      const userIngredients = ['a']; // 1 match

      const percentage = service.calculateMatchPercentage(recipeIngredients, userIngredients);

      expect(percentage).toBe(33); // 33.33% rounded to 33
    });
  });

  describe('getMissingIngredients', () => {
    it('should return empty array for perfect match', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato'];
      const userIngredients = ['chicken', 'pasta', 'tomato'];

      const missing = service.getMissingIngredients(recipeIngredients, userIngredients);

      expect(missing).toEqual([]);
    });

    it('should return missing ingredients', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato', 'garlic'];
      const userIngredients = ['chicken', 'pasta'];

      const missing = service.getMissingIngredients(recipeIngredients, userIngredients);

      expect(missing).toEqual(['tomato', 'garlic']);
    });

    it('should preserve original casing', () => {
      const recipeIngredients = ['Chicken Breast', 'Fresh Basil'];
      const userIngredients = ['chicken'];

      const missing = service.getMissingIngredients(recipeIngredients, userIngredients);

      expect(missing).toEqual(['Fresh Basil']); // Original casing preserved
    });

    it('should return all ingredients when user has none', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato'];
      const userIngredients: string[] = [];

      const missing = service.getMissingIngredients(recipeIngredients, userIngredients);

      expect(missing).toEqual(['chicken', 'pasta', 'tomato']);
    });
  });

  describe('getMatchedIngredients', () => {
    it('should return matched ingredients', () => {
      const recipeIngredients = ['chicken', 'pasta', 'tomato', 'garlic'];
      const userIngredients = ['chicken', 'pasta', 'onion'];

      const matched = service.getMatchedIngredients(recipeIngredients, userIngredients);

      expect(matched).toEqual(['chicken', 'pasta']);
    });

    it('should return empty array for no matches', () => {
      const recipeIngredients = ['chicken', 'pasta'];
      const userIngredients = ['beef', 'rice'];

      const matched = service.getMatchedIngredients(recipeIngredients, userIngredients);

      expect(matched).toEqual([]);
    });

    it('should preserve original casing', () => {
      const recipeIngredients = ['Chicken Breast', 'Fresh Basil'];
      const userIngredients = ['chicken', 'basil'];

      const matched = service.getMatchedIngredients(recipeIngredients, userIngredients);

      expect(matched).toEqual(['Chicken Breast', 'Fresh Basil']);
    });
  });

  describe('findRecipesByIngredients', () => {
    it('should return empty array for empty ingredients', async () => {
      const matches = await service.findRecipesByIngredients([]);

      expect(matches).toEqual([]);
    });

    it('should find recipes with high match percentage', async () => {
      const recipe1 = { ...mockRecipe, id: '1' };
      const recipe2 = {
        ...mockRecipe,
        id: '2',
        ingredients: [
          { name: 'beef', amount: '500', unit: 'g' },
          { name: 'rice', amount: '2', unit: 'cups' },
        ],
      };

      mockRecipeRepository.search.mockResolvedValue([recipe1, recipe2]);

      const userIngredients = ['chicken', 'pasta', 'tomato', 'garlic', 'olive oil'];
      const matches = await service.findRecipesByIngredients(userIngredients);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchPercentage).toBe(100); // Perfect match
      expect(matches[0].hasAllIngredients).toBe(true);
    });

    it('should filter recipes below minimum match percentage', async () => {
      mockRecipeRepository.search.mockResolvedValue([mockRecipe]);

      const userIngredients = ['beef']; // Only 20% match
      const matches = await service.findRecipesByIngredients(userIngredients, {
        minMatchPercentage: 50,
      });

      expect(matches).toEqual([]); // Filtered out
    });

    it('should sort recipes by match percentage descending', async () => {
      const recipe1 = {
        ...mockRecipe,
        id: '1',
        ingredients: [
          { name: 'chicken', amount: '1', unit: 'piece' },
          { name: 'pasta', amount: '1', unit: 'cup' },
        ],
      };
      const recipe2 = {
        ...mockRecipe,
        id: '2',
        ingredients: [
          { name: 'chicken', amount: '1', unit: 'piece' },
          { name: 'pasta', amount: '1', unit: 'cup' },
          { name: 'beef', amount: '1', unit: 'piece' },
          { name: 'rice', amount: '1', unit: 'cup' },
        ],
      };

      mockRecipeRepository.search.mockResolvedValue([recipe1, recipe2]);

      const userIngredients = ['chicken', 'pasta'];
      const matches = await service.findRecipesByIngredients(userIngredients);

      expect(matches[0].matchPercentage).toBeGreaterThan(matches[1].matchPercentage);
    });

    it('should apply cuisine filter', async () => {
      mockRecipeRepository.search.mockResolvedValue([mockRecipe]);

      const userIngredients = ['chicken', 'pasta'];
      await service.findRecipesByIngredients(userIngredients, {
        cuisine: 'Italian',
      });

      expect(mockRecipeRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ cuisine: 'Italian' }),
        })
      );
    });

    it('should apply difficulty filter', async () => {
      mockRecipeRepository.search.mockResolvedValue([mockRecipe]);

      const userIngredients = ['chicken', 'pasta'];
      await service.findRecipesByIngredients(userIngredients, {
        difficulty: 'easy',
      });

      expect(mockRecipeRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ difficulty: 'easy' }),
        })
      );
    });

    it('should apply max cooking time filter', async () => {
      mockRecipeRepository.search.mockResolvedValue([mockRecipe]);

      const userIngredients = ['chicken', 'pasta'];
      await service.findRecipesByIngredients(userIngredients, {
        maxCookingTime: 30,
      });

      expect(mockRecipeRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ maxCookingTime: 30 }),
        })
      );
    });

    it('should include matched and missing ingredients in results', async () => {
      mockRecipeRepository.search.mockResolvedValue([mockRecipe]);

      const userIngredients = ['chicken', 'pasta', 'tomato'];
      const matches = await service.findRecipesByIngredients(userIngredients);

      expect(matches[0]).toHaveProperty('matchedIngredients');
      expect(matches[0]).toHaveProperty('missingIngredients');
      expect(matches[0].matchedIngredients).toContain('chicken breast');
      expect(matches[0].missingIngredients).toContain('garlic');
    });

    it('should default to 50% minimum match when not specified', async () => {
      const lowMatchRecipe = {
        ...mockRecipe,
        ingredients: [
          { name: 'beef', amount: '1', unit: 'kg' },
          { name: 'rice', amount: '2', unit: 'cups' },
          { name: 'soy sauce', amount: '1', unit: 'tbsp' },
          { name: 'ginger', amount: '1', unit: 'piece' },
          { name: 'garlic', amount: '3', unit: 'cloves' },
        ],
      };

      mockRecipeRepository.search.mockResolvedValue([lowMatchRecipe]);

      const userIngredients = ['chicken']; // Only 20% match
      const matches = await service.findRecipesByIngredients(userIngredients);

      expect(matches).toEqual([]); // Below 50% default
    });

    it('should handle recipe with no ingredients - line 139', async () => {
      const emptyIngredientRecipe = {
        ...mockRecipe,
        ingredients: [],
      };

      mockRecipeRepository.search.mockResolvedValue([emptyIngredientRecipe]);

      const userIngredients = ['chicken', 'pasta'];
      const matches = await service.findRecipesByIngredients(userIngredients);

      // Recipe with no ingredients should have 0% match and be filtered out
      expect(matches).toEqual([]);
    });

    it('should match simple "s" plurals in both directions - lines 198', () => {
      // Test word1 + 's' === word2
      const recipeIngredients1 = ['apple'];
      const userIngredients1 = ['apples'];
      expect(service.calculateMatchPercentage(recipeIngredients1, userIngredients1)).toBe(100);

      // Test word2 + 's' === word1
      const recipeIngredients2 = ['oranges'];
      const userIngredients2 = ['orange'];
      expect(service.calculateMatchPercentage(recipeIngredients2, userIngredients2)).toBe(100);
    });

    it('should match "es" plurals in both directions - line 203', () => {
      // Test word1 + 'es' === word2
      const recipeIngredients1 = ['tomato'];
      const userIngredients1 = ['tomatoes'];
      expect(service.calculateMatchPercentage(recipeIngredients1, userIngredients1)).toBe(100);

      // Test word2 + 'es' === word1
      const recipeIngredients2 = ['potatoes'];
      const userIngredients2 = ['potato'];
      expect(service.calculateMatchPercentage(recipeIngredients2, userIngredients2)).toBe(100);
    });
  });
});
