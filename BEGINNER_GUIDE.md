# Beginner's Guide to Continuing This Project

## Welcome! 👋

This project was built by a professional developer with help from Claude AI, following industry best practices. Don't worry if you're a beginner - this guide will help you understand and continue the project.

## What You Need to Know

### The Project

This is a recipe sharing platform. Users can:

- Create accounts and log in
- Share recipes with photos
- Search and browse recipes
- Edit and delete their own recipes
- (More features coming!)

### The Technology

- **Next.js 15**: A React framework (frontend + backend)
- **TypeScript**: JavaScript with type safety
- **PostgreSQL**: Database for storing data
- **Prisma**: Tool to talk to the database
- **Docker**: Runs the database in a container
- **Jest**: Testing framework
- **Material-UI**: Beautiful UI components

## Getting Started

### Step 1: Make Sure Everything Works

1. **Open Terminal** in this project folder

2. **Start the database**:

   ```bash
   npm run docker:db:start
   ```

   _This starts PostgreSQL in Docker_

3. **Set up the database**:

   ```bash
   npm run db:generate
   npm run db:push
   ```

   _This creates all the tables_

4. **Run the tests**:

   ```bash
   npm test
   ```

   _You should see "359 passed" - all tests passing!_

5. **Start the app**:
   ```bash
   npm run dev
   ```
   _Open http://localhost:3000 in your browser_

### Step 2: Try the Application

1. Click "Sign Up" and create an account
2. Click "New recipe", write the ingredients one per line and the method one step per paragraph, then check and publish
3. You'll see your recipe in the feed
4. Hover over YOUR recipe card - you'll see a three-dot menu (⋮)
5. Click it to see "Edit Recipe" and "Delete Recipe" options
6. These only appear on YOUR recipes, not others'

## Understanding the Code Structure

```
src/
├── app/                    # Pages and API routes
│   ├── api/               # Backend API
│   │   ├── auth/          # Login, register, etc.
│   │   ├── recipes/       # Recipe CRUD operations
│   │   └── users/         # User management
│   ├── auth/              # Auth page
│   └── page.tsx           # Home page
│
├── components/            # Reusable UI components
│   ├── auth/             # Login/Register forms
│   ├── recipe/           # Recipe components
│   │   ├── RecipeCard.tsx      # Single recipe card (NEW: has edit/delete)
│   │   ├── RecipeFeed.tsx      # List of recipes (NEW: has delete dialog)
│   │   ├── EditRecipeModal.tsx # "Edit recipe" (thin wrapper over the editor)
│   │   └── form/               # The recipe editor: RecipeTextFirstDialog + form engine
│   └── Navigation.tsx    # Top navbar
│
├── domain/               # Business logic interfaces
│   ├── services/        # What services can do
│   ├── repositories/    # How to access data
│   └── types/          # TypeScript definitions
│
├── infrastructure/      # Actual implementations
│   ├── services/       # Business logic (NEW: RecipeService)
│   ├── repositories/   # Database access (NEW: RecipeRepository)
│   └── ai/            # AI features
│
├── contexts/           # React state management
│   └── AuthContext.tsx # User login state
│
└── lib/               # Utilities
    ├── container/     # Dependency injection
    └── database/      # Prisma setup
```

## The SOLID Principles (Simplified)

The code follows 5 important rules that make it easy to work with:

### 1. Single Responsibility

**"Each file does ONE thing"**

- `PasswordService.ts` - Only handles passwords
- `TokenService.ts` - Only handles tokens
- `RecipeService.ts` - Only handles recipe business logic

### 2. Open/Closed

**"Easy to add features, no need to change existing code"**

- Want a new database? Just create a new repository!
- Want OAuth login? Just add a new auth service!

### 3. Liskov Substitution

**"Can swap implementations easily"**

- The code uses "interfaces" (contracts)
- Any implementation following the contract works

### 4. Interface Segregation

**"Small, focused interfaces"**

- Not one giant interface with 50 methods
- Instead: small interfaces like `IPasswordService` with 3 methods

### 5. Dependency Inversion

**"Code depends on interfaces, not concrete classes"**

```typescript
// ✅ Good: Depends on interface
constructor(private repository: IRecipeRepository)

// ❌ Bad: Depends on concrete class
constructor(private repository: PrismaRecipeRepository)
```

## How to Add a New Feature

Let's say you want to add a "Like" feature:

### Step 1: Plan

1. Users can like recipes
2. Users can unlike recipes
3. See how many likes a recipe has

### Step 2: Database (Domain)

1. Create types in `src/domain/types/like.ts`
2. Create interface in `src/domain/repositories/ILikeRepository.ts`
3. Create service interface in `src/domain/services/ILikeService.ts`

### Step 3: Implementation (Infrastructure)

1. Create `src/infrastructure/repositories/LikeRepository.ts`
2. Create `src/infrastructure/services/LikeService.ts`

### Step 4: Tests ⚠️ IMPORTANT!

1. Create `src/infrastructure/repositories/__tests__/unit/LikeRepository.test.ts`
2. Create `src/infrastructure/services/__tests__/unit/LikeService.test.ts`
3. Aim for 98%+ coverage!

### Step 5: API Route

1. Create `src/app/api/recipes/[id]/like/route.ts`
2. Handle POST (like) and DELETE (unlike)

### Step 6: UI Component

1. Update `RecipeCard.tsx` to show like button
2. Add like count display
3. Handle click to toggle like

### Step 7: Test Everything

```bash
npm test                 # Run all tests
npm run dev              # Test in browser
```

## Common Tasks

### Adding a New npm Package

```bash
npm install package-name
```

### Adding a Database Field

1. Edit `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name add-field-name`
3. Run: `npm run db:generate`

### Viewing Database Content

```bash
npm run db:studio
```

_Opens a GUI at http://localhost:5555_

### Fixing Test Coverage

1. Run `npm test` to see coverage report
2. Find files below 98%
3. Look at "Uncovered Line #s" column
4. Write tests to cover those lines

### Common Test Patterns

**Testing a Service:**

```typescript
import { mockDeep } from 'jest-mock-extended';

describe('MyService', () => {
  let service: MyService;
  let mockRepository: IMyRepository;

  beforeEach(() => {
    mockRepository = mockDeep<IMyRepository>();
    service = new MyService(mockRepository);
  });

  it('should do something', async () => {
    // Arrange
    mockRepository.someMethod.mockResolvedValue(expected);

    // Act
    const result = await service.doSomething();

    // Assert
    expect(result).toEqual(expected);
  });
});
```

## Understanding the Tests

### What is "Coverage"?

Coverage tells you what % of your code is tested.

```
RecipeService.ts         | % Lines |
-------------------------|---------|
Before tests             |   2.89% | ❌ Almost nothing tested
After tests              | 100.00% | ✅ Everything tested
```

### Why 98% Coverage?

- Catches bugs before users find them
- Makes you think about edge cases
- Gives confidence when changing code
- Industry best practice for quality code

### Reading a Test

```typescript
it('should create a recipe with valid data', async () => {
  // Arrange - Set up test data
  const recipeData = { title: 'Pasta', ... };

  // Act - Do the thing you're testing
  const result = await service.createRecipe(recipeData);

  // Assert - Check if it worked
  expect(result.title).toBe('Pasta');
});
```

## What to Work On Next

### Option 1: Finish Test Coverage (Recommended for Beginners) ⭐

**Why?**: Learn the codebase by writing tests
**Time**: 2-3 hours
**Difficulty**: ⭐⭐☆☆☆

Files that need more tests:

- `AIProviderFactory.ts` (66% → 98%)
- `Container.ts` (85% → 98%)
- `TokenService.ts` (92% → 98%)

**How to start**:

```bash
npm run test:watch     # This will auto-run tests as you type
```

Open `src/infrastructure/ai/__tests__/unit/AIProviderFactory.test.ts` and add more tests.

### Option 2: Recipe Detail Page 📖

**Why?**: Create a full-page view for recipes
**Time**: 4-6 hours
**Difficulty**: ⭐⭐⭐☆☆

**What to build**:

1. Create `src/app/recipe/[id]/page.tsx`
2. Show large recipe photo
3. List all ingredients
4. Show step-by-step instructions
5. Display author info
6. Add like/comment buttons

**How to start**:

1. Look at `src/app/page.tsx` for page structure
2. Copy the pattern for `[id]` routing
3. Use RecipeCard as reference for styling

### Option 3: Recipe Editing ✏️ (already built - read it, don't copy it)

**Why?**: See how ONE editor serves both "New recipe" and "Edit recipe"
**Time**: 1-2 hours of reading
**Difficulty**: ⭐⭐⭐☆☆

**Where it lives**:

1. `src/components/recipe/form/RecipeTextFirstDialog.tsx` - the editor, `mode="create"` or `mode="edit"`
2. `src/components/recipe/EditRecipeModal.tsx` - a thin wrapper that opens it with a `recipe`
3. `src/components/recipe/form/useRecipeForm.ts` - the form engine; `toPayload()` builds what is sent
4. `src/hooks/useCreateRecipe.ts` (POST `/api/recipes`) and `src/hooks/useUpdateRecipe.ts` (PUT `/api/recipes/[id]`)

**How to start**:

1. Never duplicate the editor for a new case - add a `mode` or a prop instead
2. Follow a recipe from `recipe` prop -> `useRecipeForm({ initial })` -> `toPayload()` -> PUT
3. Read `src/components/recipe/form/__tests__/RecipeTextFirstDialog.test.tsx` to see every behaviour

## Learning Resources

### For This Project

- [ARCHITECTURE.md](ARCHITECTURE.md) - How the code is organized
- [TESTING.md](TESTING.md) - How to write tests
- [ROADMAP.md](ROADMAP.md) - What features are planned
- [SESSION_SUMMARY.md](SESSION_SUMMARY.md) - What was just built

### General Learning

- [Next.js Tutorial](https://nextjs.org/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Docs](https://react.dev/learn)
- [Prisma Getting Started](https://www.prisma.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Getting Help

### Error: "Cannot find module"

```bash
npm install              # Reinstall dependencies
```

### Error: "Database connection failed"

```bash
npm run docker:db:start  # Make sure database is running
npm run db:push          # Recreate tables
```

### Error: "Tests failing"

```bash
npm test -- --clearCache # Clear Jest cache
npm test                 # Run again
```

### Error: "Port 3000 already in use"

- Close any other apps using port 3000
- Or change port: `npm run dev -- -p 3001`

### Still Stuck?

1. Read the error message carefully
2. Google the error message
3. Check GitHub Issues
4. Ask for help in discussions

## Best Practices (Always Follow These!)

### ✅ DO:

- Write tests for ALL new code
- Follow existing code patterns
- Keep functions small and focused
- Use TypeScript types
- Comment complex logic
- Run `npm test` before committing
- Run `npm run lint` to check code style

### ❌ DON'T:

- Skip writing tests
- Put business logic in UI components
- Hardcode values (use environment variables)
- Commit `.env` file (use `.env.example`)
- Change code without understanding it
- Lower test coverage
- Ignore TypeScript errors

## Quick Command Reference

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Check code quality

# Database
npm run docker:db:start  # Start PostgreSQL
npm run docker:db:stop   # Stop PostgreSQL
npm run db:generate      # Generate Prisma client
npm run db:push          # Update database schema
npm run db:studio        # Open database GUI

# Testing
npm test                 # Run all tests with coverage
npm run test:watch       # Run tests in watch mode
npm run test:unit        # Run only unit tests

# Docker
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:logs      # View logs
npm run docker:clean     # Remove everything
```

## Remember

1. **You don't need to know everything** - The previous developer set up the structure. Your job is to follow the patterns.

2. **Tests are your friend** - If tests pass, your code probably works!

3. **Take it slow** - Start with small changes. Test often. Ask questions.

4. **Read before writing** - Look at similar code in the project before adding new code.

5. **Git is your safety net** - Commit often. You can always go back.

## Your First Task (Recommended)

**Goal**: Add one test to improve coverage

1. Run `npm test`
2. Look at the coverage report
3. Pick AIProviderFactory.ts (easiest)
4. Open `src/infrastructure/ai/__tests__/unit/AIProviderFactory.test.ts`
5. Add this test:

```typescript
it('should create a Gemini provider successfully', () => {
  const provider = AIProviderFactory.createProvider('gemini', config);
  expect(provider).toBeDefined();
  expect(provider).toBeInstanceOf(GeminiRecipeProvider);
});
```

6. Run `npm test` again
7. Coverage should increase!

Congratulations! You just improved the project! 🎉

---

**Questions?** Read [SESSION_SUMMARY.md](SESSION_SUMMARY.md) for what was just built.

**Ready for more?** Check [ROADMAP.md](ROADMAP.md) for what to build next.

**Good luck! You've got this! 💪**
