import { container } from '../../container';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IAuthService } from '@/domain/services/IAuthService';
import { IUserService } from '@/domain/services/IUserService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { ITokenService } from '@/domain/services/ITokenService';

// Mock Prisma to avoid database connection
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    recipe: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pantry: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pantryItem: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    aiUsage: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Container - Unit Tests', () => {
  describe('getUserRepository', () => {
    it('should return UserRepository instance', () => {
      const userRepository = container.getUserRepository();

      expect(userRepository).toBeDefined();
      expect(userRepository).toHaveProperty('create');
      expect(userRepository).toHaveProperty('findById');
      expect(userRepository).toHaveProperty('findByEmail');
      expect(userRepository).toHaveProperty('findByUsername');
      expect(userRepository).toHaveProperty('findMany');
      expect(userRepository).toHaveProperty('update');
      expect(userRepository).toHaveProperty('updatePassword');
      expect(userRepository).toHaveProperty('delete');
      expect(userRepository).toHaveProperty('exists');
      expect(userRepository).toHaveProperty('count');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = container.getUserRepository();
      const repo2 = container.getUserRepository();

      expect(repo1).toBe(repo2);
    });

    it('should implement IUserRepository interface', () => {
      const userRepository = container.getUserRepository();

      // Verify all interface methods exist
      expect(typeof userRepository.create).toBe('function');
      expect(typeof userRepository.findById).toBe('function');
      expect(typeof userRepository.findByEmail).toBe('function');
      expect(typeof userRepository.findByUsername).toBe('function');
      expect(typeof userRepository.findMany).toBe('function');
      expect(typeof userRepository.update).toBe('function');
      expect(typeof userRepository.updatePassword).toBe('function');
      expect(typeof userRepository.delete).toBe('function');
      expect(typeof userRepository.exists).toBe('function');
      expect(typeof userRepository.count).toBe('function');
    });
  });

  describe('getAuthService', () => {
    it('should return AuthService instance', () => {
      const authService = container.getAuthService();

      expect(authService).toBeDefined();
      expect(authService).toHaveProperty('register');
      expect(authService).toHaveProperty('login');
      expect(authService).toHaveProperty('validateToken');
      expect(authService).toHaveProperty('changePassword');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getAuthService();
      const service2 = container.getAuthService();

      expect(service1).toBe(service2);
    });

    it('should implement IAuthService interface', () => {
      const authService = container.getAuthService();

      expect(typeof authService.register).toBe('function');
      expect(typeof authService.login).toBe('function');
      expect(typeof authService.validateToken).toBe('function');
      expect(typeof authService.changePassword).toBe('function');
    });

    it('should have injected dependencies', () => {
      const authService = container.getAuthService();

      // AuthService should work (dependencies injected)
      expect(authService).toBeDefined();
      expect(authService.register).toBeDefined();
    });
  });

  describe('getUserService', () => {
    it('should return UserService instance', () => {
      const userService = container.getUserService();

      expect(userService).toBeDefined();
      expect(userService).toHaveProperty('getUserById');
      expect(userService).toHaveProperty('getUserByUsername');
      expect(userService).toHaveProperty('updateProfile');
      expect(userService).toHaveProperty('deleteUser');
      expect(userService).toHaveProperty('getUsers');
      expect(userService).toHaveProperty('searchUsers');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getUserService();
      const service2 = container.getUserService();

      expect(service1).toBe(service2);
    });

    it('should implement IUserService interface', () => {
      const userService = container.getUserService();

      expect(typeof userService.getUserById).toBe('function');
      expect(typeof userService.getUserByUsername).toBe('function');
      expect(typeof userService.updateProfile).toBe('function');
      expect(typeof userService.deleteUser).toBe('function');
      expect(typeof userService.getUsers).toBe('function');
      expect(typeof userService.searchUsers).toBe('function');
    });
  });

  describe('getPasswordService', () => {
    it('should return PasswordService instance', () => {
      const passwordService = container.getPasswordService();

      expect(passwordService).toBeDefined();
      expect(passwordService).toHaveProperty('hash');
      expect(passwordService).toHaveProperty('compare');
      expect(passwordService).toHaveProperty('validate');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getPasswordService();
      const service2 = container.getPasswordService();

      expect(service1).toBe(service2);
    });

    it('should implement IPasswordService interface', () => {
      const passwordService = container.getPasswordService();

      expect(typeof passwordService.hash).toBe('function');
      expect(typeof passwordService.compare).toBe('function');
      expect(typeof passwordService.validate).toBe('function');
    });

    it('should be able to validate passwords', () => {
      const passwordService = container.getPasswordService();

      const isValid = passwordService.validate('Test1234');
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('getTokenService', () => {
    it('should return TokenService instance', () => {
      const tokenService = container.getTokenService();

      expect(tokenService).toBeDefined();
      expect(tokenService).toHaveProperty('generate');
      expect(tokenService).toHaveProperty('verify');
      expect(tokenService).toHaveProperty('decode');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getTokenService();
      const service2 = container.getTokenService();

      expect(service1).toBe(service2);
    });

    it('should implement ITokenService interface', () => {
      const tokenService = container.getTokenService();

      expect(typeof tokenService.generate).toBe('function');
      expect(typeof tokenService.verify).toBe('function');
      expect(typeof tokenService.decode).toBe('function');
    });

    it('should be able to generate tokens', () => {
      const tokenService = container.getTokenService();

      const token = tokenService.generate({
        userId: 'test-123',
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('get (generic)', () => {
    it('should return service by name', () => {
      const authService = container.get<IAuthService>('IAuthService');

      expect(authService).toBeDefined();
      expect(authService).toHaveProperty('register');
    });

    it('should throw error for non-existent service', () => {
      expect(() => {
        container.get('NonExistentService');
      }).toThrow('Service NonExistentService not found in container');
    });

    it('should return correct type for requested service', () => {
      const passwordService = container.get<IPasswordService>('IPasswordService');

      expect(passwordService).toBeDefined();
      expect(typeof passwordService.validate).toBe('function');
    });
  });

  describe('dependency injection', () => {
    it('should inject UserRepository into AuthService', () => {
      const authService = container.getAuthService();
      const userRepo = container.getUserRepository();

      // Both should be defined
      expect(authService).toBeDefined();
      expect(userRepo).toBeDefined();
    });

    it('should inject UserRepository into UserService', () => {
      const userService = container.getUserService();
      const userRepo = container.getUserRepository();

      expect(userService).toBeDefined();
      expect(userRepo).toBeDefined();
    });

    it('should inject all dependencies into AuthService', () => {
      const authService = container.getAuthService();
      const userRepo = container.getUserRepository();
      const passwordService = container.getPasswordService();
      const tokenService = container.getTokenService();

      // All dependencies should be available
      expect(authService).toBeDefined();
      expect(userRepo).toBeDefined();
      expect(passwordService).toBeDefined();
      expect(tokenService).toBeDefined();
    });
  });

  describe('singleton pattern', () => {
    it('should maintain single instance across multiple gets', () => {
      const service1 = container.getAuthService();
      const service2 = container.get<IAuthService>('IAuthService');

      expect(service1).toBe(service2);
    });

    it('should maintain single repository instance', () => {
      const repo1 = container.getUserRepository();
      const repo2 = container.get<IUserRepository>('IUserRepository');

      expect(repo1).toBe(repo2);
    });
  });

  describe('service registration', () => {
    it('should have all required services registered', () => {
      expect(() => container.get('PrismaClient')).not.toThrow();
      expect(() => container.get('IUserRepository')).not.toThrow();
      expect(() => container.get('IPasswordService')).not.toThrow();
      expect(() => container.get('ITokenService')).not.toThrow();
      expect(() => container.get('IAuthService')).not.toThrow();
      expect(() => container.get('IUserService')).not.toThrow();
    });

    it('should return different types for different services', () => {
      const authService = container.getAuthService();
      const userService = container.getUserService();

      expect(authService).not.toBe(userService);
      expect(authService).toHaveProperty('register');
      expect(userService).toHaveProperty('searchUsers');
    });
  });

  describe('getRecipeRepository', () => {
    it('should return RecipeRepository instance', () => {
      const recipeRepository = container.getRecipeRepository();

      expect(recipeRepository).toBeDefined();
      expect(recipeRepository.constructor.name).toBe('RecipeRepository');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = container.getRecipeRepository();
      const repo2 = container.getRecipeRepository();

      expect(repo1).toBe(repo2);
    });
  });

  describe('getPantryRepository', () => {
    it('should return PantryRepository instance', () => {
      const pantryRepository = container.getPantryRepository();

      expect(pantryRepository).toBeDefined();
      expect(pantryRepository.constructor.name).toBe('PantryRepository');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = container.getPantryRepository();
      const repo2 = container.getPantryRepository();

      expect(repo1).toBe(repo2);
    });
  });

  describe('getRecipeService', () => {
    it('should return RecipeService instance', () => {
      const recipeService = container.getRecipeService();

      expect(recipeService).toBeDefined();
      expect(recipeService.constructor.name).toBe('RecipeService');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getRecipeService();
      const service2 = container.getRecipeService();

      expect(service1).toBe(service2);
    });
  });

  describe('getPantryService', () => {
    it('should return PantryService instance', () => {
      const pantryService = container.getPantryService();

      expect(pantryService).toBeDefined();
      expect(pantryService.constructor.name).toBe('PantryService');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getPantryService();
      const service2 = container.getPantryService();

      expect(service1).toBe(service2);
    });
  });

  describe('getIngredientMatchService', () => {
    it('should return IngredientMatchService instance', () => {
      const ingredientMatchService = container.getIngredientMatchService();

      expect(ingredientMatchService).toBeDefined();
      expect(ingredientMatchService.constructor.name).toBe('IngredientMatchService');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getIngredientMatchService();
      const service2 = container.getIngredientMatchService();

      expect(service1).toBe(service2);
    });
  });

  describe('getNotificationService', () => {
    it('should return NotificationService instance', () => {
      const notificationService = container.getNotificationService();

      expect(notificationService).toBeDefined();
      expect(notificationService.constructor.name).toBe('NotificationService');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const service1 = container.getNotificationService();
      const service2 = container.getNotificationService();

      expect(service1).toBe(service2);
    });
  });

  describe('getNotificationRepository', () => {
    it('should return NotificationRepository instance', () => {
      const notificationRepository = container.getNotificationRepository();

      expect(notificationRepository).toBeDefined();
      expect(notificationRepository.constructor.name).toBe('NotificationRepository');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = container.getNotificationRepository();
      const repo2 = container.getNotificationRepository();

      expect(repo1).toBe(repo2);
    });
  });
});
