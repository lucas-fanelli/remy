# Testing and Quality Standards

**Remy's Recipe Sharing Platform - v1.1.0**

This document defines the testing guidelines, architecture principles, code structure, and quality standards for the Remy's Recipe Sharing Platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Testing Strategy](#testing-strategy)
3. [Test Organization](#test-organization)
4. [Writing Tests](#writing-tests)
5. [Code Quality Standards](#code-quality-standards)
6. [SOLID Principles](#solid-principles)
7. [Type Safety](#type-safety)
8. [Error Handling](#error-handling)
9. [Performance Guidelines](#performance-guidelines)
10. [Security Best Practices](#security-best-practices)

---

## Architecture Overview

### Clean Architecture - 4 Layers

```
src/
├── domain/           # Layer 1: Domain (Interfaces & Types)
│   ├── repositories/    # Repository interfaces (IUserRepository, IRecipeRepository)
│   ├── services/        # Service interfaces (IAuthService, IRecipeService)
│   └── types/           # Domain types (Recipe, User, Pantry)
│
├── infrastructure/   # Layer 2: Infrastructure (Implementations)
│   ├── repositories/    # Repository implementations (UserRepository, RecipeRepository)
│   └── services/        # Service implementations (AuthService, RecipeService)
│
├── lib/              # Layer 3: Libraries & Utilities
│   ├── container/       # Dependency Injection container
│   ├── database/        # Prisma client singleton
│   ├── validation/      # Zod schemas for input validation
│   └── api/             # API utilities (auth, response helpers)
│
├── components/       # Layer 4: Presentation (React Components)
│   ├── auth/            # Authentication components
│   ├── recipe/          # Recipe-related components
│   ├── profile/         # User profile components
│   ├── common/          # Shared UI components
│   └── ui/              # Generic UI elements
│
├── contexts/         # React Contexts (AuthContext, ThemeContext)
├── app/              # Next.js App Router (Pages & API Routes)
└── __tests__/        # Test helpers and utilities
```

### Dependency Flow

```
Presentation → Application → Domain ← Infrastructure
     ↓              ↓           ↑           ↑
Components → Contexts → Interfaces ← Implementations
                           ↑
                      Types/DTOs
```

**Key Principle**: Dependencies only flow inward. Domain layer has NO external dependencies.

---

## Testing Strategy

### Test Types

| Type | Location | Purpose | Coverage Target |
|------|----------|---------|-----------------|
| Unit Tests | `__tests__/unit/` | Test individual functions/classes in isolation | 98%+ |
| Component Tests | `__tests__/` | Test React components with mocked dependencies | 90%+ |
| Integration Tests | `__tests__/integration/` | Test multiple layers working together | Key flows |

### Current Test Statistics

- **Total Tests**: 1,012 (1,007 passing, 5 failing*)
- **Test Suites**: 43 (41 passing, 2 failing*)
- **Service Coverage**: 99%+
- **Validation Coverage**: 100%
- **Component Coverage**: 90%+

*Note: Failing tests are in RecipeCard.test.tsx and Navigation.test.tsx due to recent UI refactoring in the `design/visual-refactor` branch. These tests need to be updated to match the new component structure.

### Testing Libraries

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/user-event": "^14.5.0",
    "jest-mock-extended": "^3.0.7",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.2.0",
    "@playwright/test": "^1.48.0"
  }
}
```

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.10 | App Router framework |
| React | 19.2.1 | UI library |
| TypeScript | 5.6.0 | Type safety |
| Material-UI | 6.1.0 | Component library |
| Prisma | 6.1.0 | ORM |
| Framer Motion | 11.5.0 | Animations |
| Zod | 3.23.0 | Validation |
| Serwist | 9.2.3 | PWA support |

---

## Test Organization

### Directory Structure

```
src/
├── infrastructure/
│   ├── services/
│   │   ├── RecipeService.ts
│   │   └── __tests__/
│   │       └── unit/
│   │           └── RecipeService.test.ts
│   └── repositories/
│       ├── RecipeRepository.ts
│       └── __tests__/
│           └── unit/
│               └── RecipeRepository.test.ts
│
├── components/
│   ├── recipe/
│   │   ├── RecipeCard.tsx
│   │   └── __tests__/
│   │       └── RecipeCard.test.tsx
│   └── auth/
│       ├── LoginForm.tsx
│       └── __tests__/
│           └── LoginForm.test.tsx
│
└── contexts/
    ├── AuthContext.tsx
    └── __tests__/
        └── AuthContext.test.tsx
```

### Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| Unit Test | `{ClassName}.test.ts` | `RecipeService.test.ts` |
| Component Test | `{ComponentName}.test.tsx` | `RecipeCard.test.tsx` |
| Test Helper | `testHelpers.ts` | `src/__tests__/helpers/testHelpers.ts` |

---

## Writing Tests

### Unit Test Template (Services)

```typescript
import { RecipeService } from '../../RecipeService';
import { IRecipeRepository } from '@/domain/repositories/IRecipeRepository';
import { mockDeep } from 'jest-mock-extended';

describe('RecipeService - Unit Tests', () => {
  let recipeService: RecipeService;
  let mockRecipeRepository: IRecipeRepository;

  // Standard mock data
  const mockRecipe: Recipe = {
    id: 'recipe-123',
    title: 'Test Recipe',
    description: 'A delicious test recipe',
    // ... complete mock object
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRecipeRepository = mockDeep<IRecipeRepository>();
    recipeService = new RecipeService(mockRecipeRepository);
  });

  describe('createRecipe', () => {
    it('should create a recipe successfully with valid data', async () => {
      mockRecipeRepository.create = jest.fn().mockResolvedValue(mockRecipe);

      const result = await recipeService.createRecipe(validCreateDTO);

      expect(result).toBeDefined();
      expect(result.title).toBe(validCreateDTO.title);
      expect(mockRecipeRepository.create).toHaveBeenCalledWith(validCreateDTO);
    });

    it('should throw error for missing title', async () => {
      const invalidDTO = { ...validCreateDTO, title: '' };

      await expect(recipeService.createRecipe(invalidDTO)).rejects.toThrow(
        'Recipe validation failed: Title is required'
      );
    });
  });
});
```

### Component Test Template

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RecipeCard from '../RecipeCard';

// Mock external dependencies
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockTheme = createTheme();

// Helper to wrap components with required providers
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('RecipeCard Component', () => {
  const mockRecipe: Recipe = {
    id: 'recipe-1',
    title: 'Test Recipe',
    // ... complete mock
  };

  it('should render recipe card with basic information', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} />);

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = jest.fn();
    renderWithTheme(<RecipeCard recipe={mockRecipe} onClick={handleClick} />);

    fireEvent.click(screen.getByText('Test Recipe'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Context Test Template

```typescript
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// Create a test component that uses the context
function TestComponent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="user-data">
        {user ? user.username : 'No User'}
      </div>
    </div>
  );
}

describe('AuthContext', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('should set authenticated when token exists', async () => {
    localStorage.setItem('auth_token', 'test-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockUser }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });
  });
});
```

### Repository Test Template

```typescript
import { RecipeRepository } from '../../RecipeRepository';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('RecipeRepository - Unit Tests', () => {
  let recipeRepository: RecipeRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    recipeRepository = new RecipeRepository(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find recipe by id', async () => {
      prismaMock.post.findUnique.mockResolvedValue(mockPost);

      const result = await recipeRepository.findById('recipe-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('recipe-123');
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 'recipe-123' },
        include: { user: { select: { username: true, fullName: true, avatar: true } } },
      });
    });

    it('should return null when recipe not found', async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);

      const result = await recipeRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });
});
```

---

## Code Quality Standards

### Test Coverage Requirements

| Layer | Minimum Coverage | Target Coverage |
|-------|------------------|-----------------|
| Domain Types | 100% | 100% |
| Infrastructure Services | 95% | 99% |
| Infrastructure Repositories | 90% | 95% |
| Validation Schemas | 100% | 100% |
| React Components | 85% | 90% |
| React Contexts | 90% | 95% |

### Coverage Configuration (jest.config.js)

```javascript
collectCoverageFrom: [
  // Core business logic - MUST have 98% coverage
  'src/domain/**/*.{ts,tsx}',
  'src/infrastructure/**/*.{ts,tsx}',
  'src/lib/validation/**/*.{ts,tsx}',
  'src/lib/container/**/*.{ts,tsx}',

  // UI Components - Track coverage
  'src/components/**/*.{ts,tsx}',
  'src/contexts/**/*.{ts,tsx}',

  // Exclusions
  '!src/**/__tests__/**',
  '!src/**/__mocks__/**',
  '!src/**/*.d.ts',
  '!src/app/**', // API routes tested via integration tests
],
```

### Test Assertions Best Practices

```typescript
// GOOD: Specific assertions
expect(result.title).toBe('Expected Title');
expect(mockRepository.create).toHaveBeenCalledWith(expectedData);
expect(result.errors).toContain('Title is required');

// AVOID: Vague assertions
expect(result).toBeTruthy();
expect(mockRepository.create).toHaveBeenCalled();
```

### Branch Coverage

Every branch must be tested. Common patterns:

```typescript
// Test both branches of a conditional
describe('updateRecipe', () => {
  it('should update when user is owner', async () => {
    // Happy path
  });

  it('should throw error when user is not owner', async () => {
    // Error path
  });

  it('should throw error when recipe not found', async () => {
    // Null case
  });
});
```

---

## SOLID Principles

### Single Responsibility Principle (SRP)

Each class/module has one reason to change:

```typescript
// GOOD: Service handles business logic only
class RecipeService implements IRecipeService {
  constructor(private recipeRepository: IRecipeRepository) {}

  async createRecipe(data: CreateRecipeDTO): Promise<Recipe> {
    this.validateRecipeData(data);
    return this.recipeRepository.create(data);
  }
}

// Repository handles data access only
class RecipeRepository implements IRecipeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateRecipeDTO): Promise<Recipe> {
    return this.prisma.post.create({ data });
  }
}
```

### Open/Closed Principle (OCP)

Open for extension, closed for modification:

```typescript
// Interface allows new implementations without changing existing code
interface IRecipeRepository {
  create(data: CreateRecipeDTO): Promise<Recipe>;
  findById(id: string): Promise<Recipe | null>;
}

// Can add new repository without modifying interface consumers
class CachedRecipeRepository implements IRecipeRepository {
  constructor(
    private baseRepository: IRecipeRepository,
    private cache: Cache
  ) {}
}
```

### Liskov Substitution Principle (LSP)

Subtypes must be substitutable for their base types:

```typescript
// Any IRecipeService implementation works
const recipeService: IRecipeService = new RecipeService(repository);
const recipeService: IRecipeService = new MockRecipeService(); // For testing
```

### Interface Segregation Principle (ISP)

Clients shouldn't depend on interfaces they don't use:

```typescript
// GOOD: Focused interfaces
interface IPasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

interface ITokenService {
  generate(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
}

// AVOID: Fat interfaces
interface IAuthHelperService {
  hashPassword(...): Promise<string>;
  verifyPassword(...): Promise<boolean>;
  generateToken(...): string;
  verifyToken(...): TokenPayload | null;
  sendEmail(...): Promise<void>;
  validateCaptcha(...): boolean;
}
```

### Dependency Inversion Principle (DIP)

High-level modules depend on abstractions:

```typescript
// Domain layer defines interfaces
// src/domain/services/IRecipeService.ts
export interface IRecipeService {
  createRecipe(data: CreateRecipeDTO): Promise<Recipe>;
}

// Infrastructure implements interfaces
// src/infrastructure/services/RecipeService.ts
export class RecipeService implements IRecipeService {
  constructor(private recipeRepository: IRecipeRepository) {}
}

// Container wires dependencies
// src/lib/container/container.ts
this.services.set('IRecipeService',
  new RecipeService(this.get('IRecipeRepository'))
);
```

---

## Type Safety

### TypeScript Best Practices

```typescript
// Always define explicit return types for public methods
async createRecipe(data: CreateRecipeDTO): Promise<Recipe> {
  // ...
}

// Use discriminated unions for state
type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Prefer interfaces for objects
interface Recipe {
  id: string;
  title: string;
  description: string;
}

// Use type for unions and primitives
type Difficulty = 'easy' | 'medium' | 'hard';
type RecipeId = string;
```

### DTO Pattern

```typescript
// Create DTO - what's needed to create
interface CreateRecipeDTO {
  title: string;
  description: string;
  userId: string;
  // Required fields
}

// Update DTO - optional fields for updates
interface UpdateRecipeDTO {
  title?: string;
  description?: string;
  // All fields optional
}

// Response type - full entity
interface Recipe {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Null Handling

```typescript
// GOOD: Explicit null handling
async getRecipeById(id: string): Promise<Recipe | null> {
  const recipe = await this.repository.findById(id);
  if (!recipe) {
    return null;
  }
  return recipe;
}

// GOOD: Throwing for business logic violations
async updateRecipe(id: string, userId: string, data: UpdateRecipeDTO): Promise<Recipe> {
  const recipe = await this.repository.findById(id);
  if (!recipe) {
    throw new Error('Recipe not found');
  }
  if (recipe.userId !== userId) {
    throw new Error('Unauthorized: You can only update your own recipes');
  }
  return this.repository.update(id, data);
}
```

---

## Error Handling

### Error Types

```typescript
// Business logic errors (expected)
throw new Error('Recipe validation failed: Title is required');
throw new Error('Unauthorized: You can only update your own recipes');
throw new Error('Recipe not found');

// These should be caught and returned as 400/401/404 responses
```

### API Route Error Handling

```typescript
// src/app/api/recipes/route.ts
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const recipe = await recipeService.createRecipe(data);
    return NextResponse.json({ data: recipe }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('validation failed')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Test Error Cases

```typescript
describe('Error Handling', () => {
  it('should throw error with specific message', async () => {
    await expect(service.createRecipe(invalidData))
      .rejects.toThrow('Recipe validation failed: Title is required');
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(service.fetchData())
      .rejects.toThrow('Network error');
  });
});
```

---

## Performance Guidelines

### Jest Configuration

```javascript
// jest.config.js
{
  maxWorkers: '50%',        // Use 50% of CPU cores
  cache: true,              // Cache transformed modules
  workerIdleMemoryLimit: '512MB', // Restart memory-hungry workers
}
```

### Test Performance Tips

1. **Mock expensive operations**
   ```typescript
   // Mock Prisma instead of using real database
   prismaMock = mockDeep<PrismaClient>();
   ```

2. **Use beforeEach efficiently**
   ```typescript
   // Create mocks once, reset between tests
   beforeEach(() => {
     jest.clearAllMocks();
     mockRepository.create.mockResolvedValue(mockRecipe);
   });
   ```

3. **Avoid unnecessary async/await**
   ```typescript
   // GOOD: Synchronous when possible
   it('should validate input', () => {
     expect(validateEmail('invalid')).toBe(false);
   });
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=RecipeService

# Run tests in watch mode
npm test -- --watch
```

---

## Security Best Practices

### Input Validation

All user input must be validated using Zod schemas:

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod';

export const createRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().min(1).max(500),
  cookingTime: z.number().positive().max(720),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.array(instructionSchema).min(1),
});
```

### Authentication Testing

```typescript
describe('Authorization', () => {
  it('should reject unauthenticated requests', async () => {
    const response = await fetch('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(recipeData),
    });

    expect(response.status).toBe(401);
  });

  it('should reject unauthorized actions', async () => {
    // User trying to delete another user's recipe
    await expect(
      recipeService.deleteRecipe('recipe-123', 'different-user')
    ).rejects.toThrow('Unauthorized');
  });
});
```

### Sensitive Data

```typescript
// Never log or expose sensitive data
// AVOID:
console.log('User password:', password);

// GOOD:
console.log('Login attempt for user:', username);

// Never expose internal errors to clients
// AVOID:
return NextResponse.json({ error: dbError.message });

// GOOD:
return NextResponse.json({ error: 'An error occurred' });
```

---

## Appendix: Test Helpers

### Standard Mock Data

Located in `src/__tests__/helpers/testHelpers.ts`:

```typescript
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashed_password',
  fullName: 'Test User',
  bio: null,
  avatar: null,
  website: null,
  isVerified: false,
  isPrivate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function createMockRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;
  return new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function createAuthHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
```

### Jest Setup

Located in `jest.setup.js`:

```javascript
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();
```

---

## Quick Reference

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests with coverage |
| `npm run test:watch` | Watch mode for development |
| `npm run test:unit` | Run only unit tests |
| `npm run test:integration` | Run only integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run E2E tests with UI |
| `npm run test:all` | Run all tests (unit + E2E) |
| `npm run test:coverage` | Run with 98% coverage threshold |
| `npm test -- --testPathPattern=Name` | Run specific tests |

### Coverage Targets

| Layer | Target |
|-------|--------|
| Services | 99%+ |
| Repositories | 95%+ |
| Validation | 100% |
| Components | 90%+ |
| Contexts | 95%+ |

### Architecture Checklist

- [ ] Interfaces defined in `src/domain/`
- [ ] Implementations in `src/infrastructure/`
- [ ] Types/DTOs in `src/domain/types/`
- [ ] Dependency injection via container
- [ ] No direct database access in services
- [ ] All public methods have explicit return types
- [ ] All user input validated with Zod

---

*Last Updated: December 14, 2024*
*Version: 1.1.0*
