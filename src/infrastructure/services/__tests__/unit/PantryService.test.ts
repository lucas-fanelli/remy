import { PantryService } from '../../PantryService';
import { IPantryRepository } from '@/domain/repositories/IPantryRepository';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { IngredientCategory } from '@/domain/types/pantry';

describe('PantryService', () => {
  let service: PantryService;
  let mockPantryRepository: DeepMockProxy<IPantryRepository>;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  const userId = 'test-user-123';

  beforeEach(() => {
    mockPantryRepository = mockDeep<IPantryRepository>();
    mockPrisma = mockDeep<PrismaClient>();
    service = new PantryService(mockPantryRepository, mockPrisma);
  });

  describe('getUserPantry', () => {
    it('should return user pantry if exists', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
          { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      mockPantryRepository.findByUserId.mockResolvedValue(mockPantry);

      const result = await service.getUserPantry(userId);

      expect(result).toEqual(mockPantry);
      expect(mockPantryRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return null when pantry not found', async () => {
      mockPantryRepository.findByUserId.mockResolvedValue(null);

      const result = await service.getUserPantry(userId);

      expect(result).toBeNull();
    });
  });

  describe('addIngredients', () => {
    it('should add new ingredients with auto-categorization', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['tomato']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'tomato',
            category: IngredientCategory.VEGETABLE,
          }),
        ])
      );
    });

    it('should categorize vegetables correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'carrot', category: IngredientCategory.VEGETABLE, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['carrot']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'carrot',
            category: IngredientCategory.VEGETABLE,
          }),
        ])
      );
    });

    it('should categorize fruits correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'apple', category: IngredientCategory.FRUIT, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['apple']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'apple',
            category: IngredientCategory.FRUIT,
          }),
        ])
      );
    });

    it('should categorize protein correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['chicken']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'chicken',
            category: IngredientCategory.PROTEIN,
          }),
        ])
      );
    });

    it('should categorize dairy correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'milk', category: IngredientCategory.DAIRY, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['milk']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'milk',
            category: IngredientCategory.DAIRY,
          }),
        ])
      );
    });

    it('should categorize grains correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'rice', category: IngredientCategory.GRAIN, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['rice']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'rice',
            category: IngredientCategory.GRAIN,
          }),
        ])
      );
    });

    it('should categorize spices correctly', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'oregano', category: IngredientCategory.SPICE, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['oregano']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'oregano',
            category: IngredientCategory.SPICE,
          }),
        ])
      );
    });

    it('should use existing category from database if ingredient exists', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'special-ingredient', category: IngredientCategory.SPICE, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'special-ingredient',
        category: IngredientCategory.SPICE,
        createdAt: new Date(),
      });
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['special-ingredient']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'special-ingredient',
            category: IngredientCategory.SPICE,
          }),
        ])
      );
    });

    it('should save ingredients to global catalog if they do not exist', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'new-ingredient', category: IngredientCategory.OTHER, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['new-ingredient']);

      expect(mockPrisma.ingredient.create).toHaveBeenCalledWith({
        data: {
          name: 'new-ingredient',
          category: IngredientCategory.OTHER,
        },
      });
    });

    it('should trim ingredient names', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: expect.any(Date) },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.ingredient.create as jest.Mock).mockResolvedValue({});
      mockPantryRepository.addIngredients.mockResolvedValue(mockPantry);

      await service.addIngredients(userId, ['  tomato  ']);

      expect(mockPantryRepository.addIngredients).toHaveBeenCalledWith(
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            name: 'tomato', // Trimmed
          }),
        ])
      );
    });
  });

  describe('removeIngredients', () => {
    it('should remove ingredients from pantry', async () => {
      const mockPantry = {
        id: '1',
        userId,
        ingredients: [
          { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      mockPantryRepository.removeIngredients.mockResolvedValue(mockPantry);

      const result = await service.removeIngredients(userId, ['tomato']);

      expect(result).toEqual(mockPantry);
      expect(mockPantryRepository.removeIngredients).toHaveBeenCalledWith(userId, ['tomato']);
    });

    it('should throw error when no ingredients specified', async () => {
      await expect(
        service.removeIngredients(userId, [])
      ).rejects.toThrow('No ingredients specified for removal');
    });
  });

  describe('clearPantry', () => {
    it('should clear all ingredients from pantry', async () => {
      mockPantryRepository.exists.mockResolvedValue(true);

      await service.clearPantry(userId);

      expect(mockPantryRepository.clearPantry).toHaveBeenCalledWith(userId);
    });

    it('should throw error if pantry does not exist', async () => {
      mockPantryRepository.exists.mockResolvedValue(false);

      await expect(
        service.clearPantry(userId)
      ).rejects.toThrow('Pantry not found');
    });
  });

  describe('searchIngredients', () => {
    it('should return matching ingredient names from catalog', async () => {
      const mockIngredients = [
        { id: '1', name: 'tomato', category: IngredientCategory.VEGETABLE, createdAt: new Date() },
        { id: '2', name: 'tomato sauce', category: IngredientCategory.CONDIMENT, createdAt: new Date() },
      ];

      (mockPrisma.ingredient.findMany as jest.Mock).mockResolvedValue(mockIngredients);

      const results = await service.searchIngredients('tomat');

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('tomato');
      expect(results[1]).toBe('tomato sauce');
      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'tomat',
            mode: 'insensitive',
          },
        },
        take: 20, // Default limit
        orderBy: { name: 'asc' },
      });
    });

    it('should respect custom limit', async () => {
      (mockPrisma.ingredient.findMany as jest.Mock).mockResolvedValue([]);

      await service.searchIngredients('ab', 10); // Must be at least 2 characters

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should return empty array for queries less than 2 characters', async () => {
      const results = await service.searchIngredients('a');

      expect(results).toEqual([]);
      expect(mockPrisma.ingredient.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const results = await service.searchIngredients('');

      expect(results).toEqual([]);
      expect(mockPrisma.ingredient.findMany).not.toHaveBeenCalled();
    });
  });

  describe('categorizeIngredient', () => {
    it('should return existing category from database', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'chicken',
        category: IngredientCategory.PROTEIN,
        createdAt: new Date(),
      });

      const category = await service.categorizeIngredient('chicken');

      expect(category).toBe(IngredientCategory.PROTEIN);
    });

    it('should categorize vegetables', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('carrot');

      expect(category).toBe(IngredientCategory.VEGETABLE);
    });

    it('should categorize fruits', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('apple');

      expect(category).toBe(IngredientCategory.FRUIT);
    });

    it('should categorize proteins', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('chicken');

      expect(category).toBe(IngredientCategory.PROTEIN);
    });

    it('should categorize dairy', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('milk');

      expect(category).toBe(IngredientCategory.DAIRY);
    });

    it('should categorize grains', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('rice');

      expect(category).toBe(IngredientCategory.GRAIN);
    });

    it('should categorize spices', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('oregano');

      expect(category).toBe(IngredientCategory.SPICE);
    });

    it('should categorize condiments', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('ketchup');

      expect(category).toBe(IngredientCategory.CONDIMENT);
    });

    it('should categorize baking ingredients', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('baking powder');

      expect(category).toBe(IngredientCategory.BAKING);
    });

    it('should return OTHER for unknown ingredients', async () => {
      (mockPrisma.ingredient.findFirst as jest.Mock).mockResolvedValue(null);

      const category = await service.categorizeIngredient('unknown-ingredient');

      expect(category).toBe(IngredientCategory.OTHER);
    });
  });
});
