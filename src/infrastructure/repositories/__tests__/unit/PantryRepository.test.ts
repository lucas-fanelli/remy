import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { IngredientCategory } from '@/domain/types/pantry';
import { PantryRepository } from '../../PantryRepository';

describe('PantryRepository', () => {
  let repository: PantryRepository;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  const userId = 'test-user-123';

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>();
    repository = new PantryRepository(mockPrisma);
  });

  describe('findByUserId', () => {
    it('should find pantry by user id', async () => {
      const mockPantry = {
        id: 'pantry-1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(mockPantry);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual(mockPantry);
      expect(mockPrisma.userPantry.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return null when pantry not found', async () => {
      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUserId(userId);

      expect(result).toBeNull();
    });

    it('should handle pantry with undefined ingredients', async () => {
      const mockPantry = {
        id: 'pantry-1',
        userId,
        ingredients: undefined,
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(mockPantry);

      const result = await repository.findByUserId(userId);

      expect(result).not.toBeNull();
      expect(result?.ingredients).toEqual([]);
    });

    it('should handle pantry with null ingredients', async () => {
      const mockPantry = {
        id: 'pantry-1',
        userId,
        ingredients: null,
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(mockPantry);

      const result = await repository.findByUserId(userId);

      expect(result).not.toBeNull();
      expect(result?.ingredients).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create new pantry', async () => {
      const ingredients = [
        { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
      ];

      const mockCreated = {
        id: 'pantry-1',
        userId,
        ingredients,
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await repository.create(userId, ingredients);

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.userPantry.create).toHaveBeenCalledWith({
        data: {
          userId,
          ingredients,
        },
      });
    });

    it('should create pantry with empty ingredients', async () => {
      const ingredients: any[] = [];

      const mockCreated = {
        id: 'pantry-1',
        userId,
        ingredients: [],
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await repository.create(userId, ingredients);

      expect(result.ingredients).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update pantry', async () => {
      const ingredients = [
        { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
        { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: new Date() },
      ];

      const mockUpdated = {
        id: 'pantry-1',
        userId,
        ingredients,
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await repository.update(userId, ingredients);

      expect(result).toEqual(mockUpdated);
      expect(mockPrisma.userPantry.update).toHaveBeenCalledWith({
        where: { userId },
        data: { ingredients },
      });
    });

    it('should clear pantry by updating with empty ingredients', async () => {
      const ingredients: any[] = [];

      const mockUpdated = {
        id: 'pantry-1',
        userId,
        ingredients: [],
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await repository.update(userId, ingredients);

      expect(result.ingredients).toEqual([]);
    });
  });

  describe('addIngredients', () => {
    it('should add new ingredients to existing pantry', async () => {
      const existingPantry = {
        id: 'pantry-1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      const newIngredients = [
        { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: new Date() },
      ];

      const updatedPantry = {
        ...existingPantry,
        ingredients: [...existingPantry.ingredients, ...newIngredients],
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(existingPantry);
      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(updatedPantry);

      const result = await repository.addIngredients(userId, newIngredients);

      expect(result.ingredients).toHaveLength(2);
    });

    it('should avoid duplicate ingredients', async () => {
      const existingPantry = {
        id: 'pantry-1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      const duplicateIngredients = [
        { name: 'Tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() }, // Different case
      ];

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(existingPantry);
      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(existingPantry);

      const result = await repository.addIngredients(userId, duplicateIngredients);

      expect(result.ingredients).toHaveLength(1); // Should not add duplicate
    });

    it('should create pantry if does not exist', async () => {
      const newIngredients = [
        { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
      ];

      const newPantry = {
        id: 'pantry-1',
        userId,
        ingredients: newIngredients,
        updatedAt: new Date(),
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.userPantry.create as jest.Mock).mockResolvedValue(newPantry);

      const result = await repository.addIngredients(userId, newIngredients);

      expect(mockPrisma.userPantry.create).toHaveBeenCalled();
      expect(result.ingredients).toHaveLength(1);
    });
  });

  describe('removeIngredients', () => {
    it('should remove ingredients from pantry', async () => {
      const existingPantry = {
        id: 'pantry-1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
          { name: 'chicken', category: IngredientCategory.PROTEIN, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      const updatedPantry = {
        ...existingPantry,
        ingredients: [existingPantry.ingredients[1]], // Only chicken
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(existingPantry);
      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(updatedPantry);

      const result = await repository.removeIngredients(userId, ['tomato']);

      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].name).toBe('chicken');
    });

    it('should be case insensitive when removing', async () => {
      const existingPantry = {
        id: 'pantry-1',
        userId,
        ingredients: [
          { name: 'tomato', category: IngredientCategory.VEGETABLE, addedAt: new Date() },
        ],
        updatedAt: new Date(),
      };

      const updatedPantry = {
        ...existingPantry,
        ingredients: [],
      };

      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(existingPantry);
      (mockPrisma.userPantry.update as jest.Mock).mockResolvedValue(updatedPantry);

      const result = await repository.removeIngredients(userId, ['TOMATO']);

      expect(result.ingredients).toHaveLength(0);
    });

    it('should throw error if pantry not found', async () => {
      (mockPrisma.userPantry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repository.removeIngredients(userId, ['tomato'])).rejects.toThrow(
        'Pantry not found'
      );
    });
  });

  describe('clearPantry', () => {
    it('should clear all ingredients from pantry', async () => {
      await repository.clearPantry(userId);

      expect(mockPrisma.userPantry.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          ingredients: [],
        },
      });
    });
  });

  describe('exists', () => {
    it('should return true if pantry exists', async () => {
      (mockPrisma.userPantry.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.exists(userId);

      expect(result).toBe(true);
      expect(mockPrisma.userPantry.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return false if pantry does not exist', async () => {
      (mockPrisma.userPantry.count as jest.Mock).mockResolvedValue(0);

      const result = await repository.exists(userId);

      expect(result).toBe(false);
    });
  });
});
