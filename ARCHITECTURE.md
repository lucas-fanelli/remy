# Architecture & SOLID Principles

This document explains how SOLID principles are implemented throughout the codebase.

## SOLID Principles

### 1. Single Responsibility Principle (SRP)

**"A class should have one, and only one, reason to change."**

#### Implementation Examples:

**PasswordService** ([src/infrastructure/services/PasswordService.ts](src/infrastructure/services/PasswordService.ts))
- **Single Responsibility**: Password operations only (hashing, comparing, validating)
- Does NOT handle user creation, authentication, or token generation
- Easy to test in isolation
- Can be replaced with different hashing algorithms without affecting other code

**TokenService** ([src/infrastructure/services/TokenService.ts](src/infrastructure/services/TokenService.ts))
- **Single Responsibility**: JWT token operations only (generate, verify, decode)
- Does NOT handle user authentication or password management
- Can switch from JWT to another token system without affecting other services

**UserRepository** ([src/infrastructure/repositories/UserRepository.ts](src/infrastructure/repositories/UserRepository.ts))
- **Single Responsibility**: Data access for users only
- Does NOT contain business logic
- Only concerned with CRUD operations on the database

### 2. Open/Closed Principle (OCP)

**"Software entities should be open for extension but closed for modification."**

#### Implementation Examples:

**Service Interfaces** ([src/domain/services/](src/domain/services/))
- Interfaces define contracts that are open for extension
- New implementations can be added without modifying existing code
- Example: Adding OAuth authentication doesn't require changing `IAuthService` interface

**Repository Pattern**
- New data sources can be added by implementing `IUserRepository`
- Could add MongoDB, Redis, or file-based implementations without changing business logic
- Example: Switching from Prisma to TypeORM only requires a new repository implementation

### 3. Liskov Substitution Principle (LSP)

**"Derived classes must be substitutable for their base classes."**

#### Implementation Examples:

**Repository Implementations**
\`\`\`typescript
// Any implementation of IUserRepository can be used interchangeably
const userRepo: IUserRepository = new UserRepository(prisma);
// OR
const userRepo: IUserRepository = new InMemoryUserRepository();
// OR
const userRepo: IUserRepository = new MongoUserRepository();
\`\`\`

**Service Implementations**
\`\`\`typescript
// AuthService works with any IPasswordService implementation
const authService = new AuthService(
  userRepository,
  passwordService,  // Could be BcryptPasswordService, Argon2Service, etc.
  tokenService
);
\`\`\`

### 4. Interface Segregation Principle (ISP)

**"Many client-specific interfaces are better than one general-purpose interface."**

#### Implementation Examples:

**Separated Service Interfaces**
- `IPasswordService` - Only password operations (3 methods)
- `ITokenService` - Only token operations (3 methods)
- `IAuthService` - Only authentication operations (4 methods)
- `IUserService` - Only user management operations (6 methods)

**Why NOT Combined?**
Instead of one large `IUserManagementService` with 16+ methods, we have focused interfaces:
- Clients only depend on methods they actually use
- Easier to mock for testing
- More maintainable and understandable

### 5. Dependency Inversion Principle (DIP)

**"Depend on abstractions, not concretions."**

#### Implementation Examples:

**Dependency Injection Container** ([src/lib/container/container.ts](src/lib/container/container.ts))
\`\`\`typescript
// High-level AuthService depends on abstractions (interfaces)
class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,      // Interface, not concrete class
    private readonly passwordService: IPasswordService,    // Interface, not concrete class
    private readonly tokenService: ITokenService          // Interface, not concrete class
  ) {}
}
\`\`\`

**Benefits:**
- AuthService doesn't know about Prisma, bcrypt, or JWT
- Easy to swap implementations for testing or production
- Changes to implementations don't affect AuthService

## Layered Architecture

### Domain Layer (Interfaces)
**Location**: `src/domain/`

- Contains interfaces and types
- No implementation details
- Pure business logic definitions
- No dependencies on frameworks

**Files:**
- `IUserRepository.ts` - User data access interface
- `IAuthService.ts` - Authentication logic interface
- `IUserService.ts` - User management interface
- `IPasswordService.ts` - Password operations interface
- `ITokenService.ts` - Token operations interface

### Infrastructure Layer (Implementations)
**Location**: `src/infrastructure/`

- Implements domain interfaces
- Contains framework-specific code
- Database access, external APIs, etc.

**Files:**
- `UserRepository.ts` - Prisma implementation
- `AuthService.ts` - Authentication logic
- `UserService.ts` - User management
- `PasswordService.ts` - bcrypt implementation
- `TokenService.ts` - JWT implementation

### Application Layer (API Routes)
**Location**: `src/app/api/`

- HTTP request/response handling
- Input validation
- Error handling
- Uses services from infrastructure layer

### Presentation Layer (Components)
**Location**: `src/components/`, `src/app/`

- React components
- User interface
- Uses contexts and hooks
- No direct database access

## Design Patterns Used

### 1. Repository Pattern
**Purpose**: Abstracts data access layer

**Example**: [UserRepository.ts](src/infrastructure/repositories/UserRepository.ts)
- Separates business logic from data access
- Makes it easy to change data sources
- Simplifies testing with mock repositories

### 2. Dependency Injection
**Purpose**: Manages object dependencies

**Example**: [container.ts](src/lib/container/container.ts)
- Central place for service creation
- Manages service lifecycles
- Makes testing easier

### 3. Factory Pattern
**Purpose**: Creates objects without specifying exact classes

**Example**: Container's service creation
\`\`\`typescript
container.get<IAuthService>('IAuthService')
\`\`\`

### 4. Singleton Pattern
**Purpose**: Ensures only one instance exists

**Examples**:
- Prisma Client ([prisma.ts](src/lib/database/prisma.ts))
- DI Container ([container.ts](src/lib/container/container.ts))

### 5. Provider Pattern (React)
**Purpose**: Shares state across components

**Example**: [AuthContext.tsx](src/contexts/AuthContext.tsx)
- Provides authentication state
- Avoids prop drilling
- Centralized auth logic

## Benefits of This Architecture

### 1. Testability
- Easy to mock interfaces for unit tests
- Each layer can be tested independently
- No need for database in service tests

### 2. Maintainability
- Changes are localized to specific layers
- Clear separation of concerns
- Easy to understand code organization

### 3. Scalability
- Can add new features without changing existing code
- Easy to add new data sources
- Can switch frameworks with minimal impact

### 4. Flexibility
- Easy to swap implementations
- Can add new authentication methods
- Database-agnostic business logic

### 5. Code Reusability
- Services can be reused across different parts of the app
- Repository implementations can be shared
- Interface definitions are framework-independent

## Testing Strategy

### Unit Tests
- Test services with mocked repositories
- Test repositories with in-memory database
- Test utilities in isolation

### Integration Tests
- Test API routes with test database
- Test service + repository integration
- Test authentication flow end-to-end

### Example Mock:
\`\`\`typescript
// Mock repository for testing AuthService
class MockUserRepository implements IUserRepository {
  private users: User[] = [];

  async create(data: CreateUserDTO): Promise<User> {
    const user = { id: '123', ...data } as User;
    this.users.push(user);
    return user;
  }
  // ... other methods
}

// Test AuthService without database
const authService = new AuthService(
  new MockUserRepository(),
  new PasswordService(),
  new TokenService()
);
\`\`\`

## Future Improvements

1. **Add Command Query Responsibility Segregation (CQRS)**
   - Separate read and write operations
   - Optimize queries independently

2. **Event-Driven Architecture**
   - Emit events on user creation, login, etc.
   - Loosely coupled features

3. **Domain Events**
   - User registered event
   - Password changed event
   - Profile updated event

4. **Specification Pattern**
   - Complex query building
   - Reusable query logic

5. **Unit of Work Pattern**
   - Transaction management
   - Batch operations

## Conclusion

This architecture demonstrates how SOLID principles create maintainable, testable, and scalable applications. The separation of concerns allows each part of the system to evolve independently while maintaining a clean, understandable codebase.
