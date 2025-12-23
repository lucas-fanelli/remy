import { PrismaClient } from '@prisma/client';

// Repositories
import { INotificationRepository } from '@/domain/repositories/INotificationRepository';
import { IPantryRepository } from '@/domain/repositories/IPantryRepository';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { IAdminService } from '@/domain/services/IAdminService';
import { IAuthService } from '@/domain/services/IAuthService';
import { IIngredientMatchService } from '@/domain/services/IIngredientMatchService';
import { INotificationService } from '@/domain/services/INotificationService';
import { IPantryService } from '@/domain/services/IPantryService';
import { IPasswordService } from '@/domain/services/IPasswordService';
import { IRecipeService } from '@/domain/services/IRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';
import { IUserService } from '@/domain/services/IUserService';
import { NotificationRepository } from '@/infrastructure/repositories/NotificationRepository';
import { PantryRepository } from '@/infrastructure/repositories/PantryRepository';
import { RecipeRepository } from '@/infrastructure/repositories/RecipeRepository';
import { UserRepository } from '@/infrastructure/repositories/UserRepository';

// Services
import { AdminService } from '@/infrastructure/services/AdminService';
import { AuthService } from '@/infrastructure/services/AuthService';
import { IngredientMatchService } from '@/infrastructure/services/IngredientMatchService';
import { NotificationService } from '@/infrastructure/services/NotificationService';
import { PantryService } from '@/infrastructure/services/PantryService';
import { PasswordService } from '@/infrastructure/services/PasswordService';
import { RecipeService } from '@/infrastructure/services/RecipeService';
import { TokenService } from '@/infrastructure/services/TokenService';
import { UserService } from '@/infrastructure/services/UserService';
import prisma from '@/lib/database/prisma';

// Dependency Injection Container
// Single Responsibility: Manages object creation and dependencies
// Dependency Inversion: High-level modules depend on abstractions
class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();

  private constructor() {
    this.registerDependencies();
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  private registerDependencies(): void {
    // Register Prisma Client
    this.services.set('PrismaClient', prisma);

    // Register Repositories
    this.services.set(
      'IUserRepository',
      new UserRepository(this.services.get('PrismaClient') as PrismaClient)
    );

    this.services.set(
      'IRecipeRepository',
      new RecipeRepository(this.services.get('PrismaClient') as PrismaClient)
    );

    this.services.set(
      'IPantryRepository',
      new PantryRepository(this.services.get('PrismaClient') as PrismaClient)
    );

    this.services.set(
      'INotificationRepository',
      new NotificationRepository(this.services.get('PrismaClient') as PrismaClient)
    );

    // Register Basic Services
    this.services.set('IPasswordService', new PasswordService());
    this.services.set('ITokenService', new TokenService());

    this.services.set(
      'IAuthService',
      new AuthService(
        this.services.get('IUserRepository') as IUserRepository,
        this.services.get('IPasswordService') as IPasswordService,
        this.services.get('ITokenService') as ITokenService
      )
    );

    this.services.set(
      'IUserService',
      new UserService(this.services.get('IUserRepository') as IUserRepository)
    );

    this.services.set(
      'IRecipeService',
      new RecipeService(this.services.get('IRecipeRepository') as IRecipeRepository)
    );

    // Register Pantry Service
    this.services.set(
      'IPantryService',
      new PantryService(
        this.services.get('IPantryRepository') as IPantryRepository,
        this.services.get('PrismaClient') as PrismaClient
      )
    );

    // Register Ingredient Match Service
    this.services.set(
      'IIngredientMatchService',
      new IngredientMatchService(this.services.get('IRecipeRepository') as IRecipeRepository)
    );

    // Register Notification Service
    this.services.set(
      'INotificationService',
      new NotificationService(
        this.services.get('INotificationRepository') as INotificationRepository
      )
    );

    // Register Admin Service
    this.services.set(
      'IAdminService',
      new AdminService(this.services.get('PrismaClient') as PrismaClient)
    );
  }

  public get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }
    return service as T;
  }

  // Convenience methods for common services
  public getUserRepository(): IUserRepository {
    return this.get<IUserRepository>('IUserRepository');
  }

  public getRecipeRepository(): IRecipeRepository {
    return this.get<IRecipeRepository>('IRecipeRepository');
  }

  public getPantryRepository(): IPantryRepository {
    return this.get<IPantryRepository>('IPantryRepository');
  }

  public getAuthService(): IAuthService {
    return this.get<IAuthService>('IAuthService');
  }

  public getUserService(): IUserService {
    return this.get<IUserService>('IUserService');
  }

  public getRecipeService(): IRecipeService {
    return this.get<IRecipeService>('IRecipeService');
  }

  public getPantryService(): IPantryService {
    return this.get<IPantryService>('IPantryService');
  }

  public getIngredientMatchService(): IIngredientMatchService {
    return this.get<IIngredientMatchService>('IIngredientMatchService');
  }

  public getPasswordService(): IPasswordService {
    return this.get<IPasswordService>('IPasswordService');
  }

  public getTokenService(): ITokenService {
    return this.get<ITokenService>('ITokenService');
  }

  public getNotificationService(): INotificationService {
    return this.get<INotificationService>('INotificationService');
  }

  public getNotificationRepository(): INotificationRepository {
    return this.get<INotificationRepository>('INotificationRepository');
  }

  public getAdminService(): IAdminService {
    return this.get<IAdminService>('IAdminService');
  }
}

export const container = Container.getInstance();
