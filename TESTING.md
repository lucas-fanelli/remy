# Testing Documentation

## Test Coverage Target: 98%+

This project maintains a **minimum 98% code coverage** requirement across all metrics: statements, branches, functions, and lines.

## Test Infrastructure

### Testing Stack
- **Jest**: Unit and integration testing framework
- **React Testing Library**: Component testing
- **Playwright**: End-to-end testing
- **jest-mock-extended**: Advanced mocking capabilities
- **ts-jest**: TypeScript support for Jest

### Configuration Files
- `jest.config.js` - Jest configuration with 98% coverage thresholds
- `jest.setup.js` - Global test setup and mocks
- `playwright.config.ts` - E2E test configuration

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests (unit + integration + E2E)
npm run test:all

# Enforce 98% coverage threshold
npm run test:coverage
```

## Test Structure

```
src/
├── __tests__/
│   └── helpers/
│       └── testHelpers.ts        # Shared test utilities
├── infrastructure/
│   ├── repositories/
│   │   └── __tests__/
│   │       └── unit/             # Repository unit tests
│   └── services/
│       └── __tests__/
│           └── unit/             # Service unit tests
├── app/
│   └── api/
│       └── */
│           └── __tests__/
│               └── integration/  # API route integration tests
└── components/
    └── */
        └── __tests__/
            └── unit/             # Component unit tests
```

## Test Categories

### 1. Unit Tests (103 tests currently passing)

#### Service Tests
- **PasswordService** (12 tests)
  - Hash password generation
  - Password comparison
  - Password validation rules
  - Edge cases (empty, null, too long)

- **TokenService** (15 tests)
  - JWT token generation
  - Token verification
  - Token decoding
  - Secret handling
  - Expiration handling

- **AuthService** (23 tests)
  - User registration with validation
  - User login (email and username)
  - Token validation
  - Password change
  - Error handling for all scenarios

- **UserService** (18 tests)
  - Get user by ID/username
  - Update profile with validation
  - Delete user
  - User pagination
  - User search functionality

#### Validation Tests
- **Schemas** (35 tests)
  - Register schema validation
  - Login schema validation
  - Password change validation
  - Profile update validation
  - Pagination validation
  - Search validation

### 2. Integration Tests

#### API Routes
- **POST /api/auth/register**
  - Successful registration
  - Email validation
  - Username validation
  - Password strength validation
  - Duplicate user handling

- **POST /api/auth/login**
  - Login with email
  - Login with username
  - Invalid credentials
  - Missing fields

- **GET /api/auth/me**
  - Authenticated user retrieval
  - Invalid token handling

- **POST /api/auth/change-password**
  - Successful password change
  - Old password verification
  - New password validation

- **GET /api/users/[username]**
  - User profile retrieval
  - Non-existent user handling

- **PUT /api/users/profile**
  - Profile updates
  - Validation enforcement

- **GET /api/users/search**
  - User search by username
  - User search by name
  - Pagination

### 3. Component Tests

#### Authentication Components
- **LoginForm**
  - Form rendering
  - Input handling
  - Form submission
  - Error display
  - Loading states
  - Navigation

- **RegisterForm**
  - Form rendering with all fields
  - Validation feedback
  - Submission handling
  - Error states

#### UI Components
- **Navigation**
  - Desktop/mobile rendering
  - User menu
  - Logout functionality
  - Active state handling

- **Post**
  - Like/unlike
  - Comments
  - Save functionality
  - Animations

### 4. End-to-End Tests (Playwright)

#### Authentication Flow
- User registration flow
- Login flow
- Logout flow
- Protected route access
- Token persistence

#### User Management
- Profile viewing
- Profile editing
- Account deletion

## Mocking Strategy

### External Dependencies
- **Prisma**: Mocked in all unit tests
- **Next.js Router**: Mocked globally in jest.setup.js
- **LocalStorage**: Mocked globally
- **Fetch API**: Mocked for API tests

### Service Mocking (Dependency Injection)
All services use interfaces, making them easy to mock:

\`\`\`typescript
const mockUserRepository = mockDeep<IUserRepository>();
const mockPasswordService = mockDeep<IPasswordService>();
const mockTokenService = mockDeep<ITokenService>();

const authService = new AuthService(
  mockUserRepository,
  mockPasswordService,
  mockTokenService
);
\`\`\`

## Coverage Requirements

```javascript
coverageThreshold: {
  global: {
    branches: 98,
    functions: 98,
    lines: 98,
    statements: 98,
  },
}
```

### Current Coverage Status

```
Service Layer:         99.06% ✅
Validation Layer:      100%   ✅
Infrastructure:        99.06% ✅
```

Still need to complete:
- API route integration tests (in progress)
- Component tests (in progress)
- E2E tests (planned)

## Test Writing Guidelines

### 1. Unit Tests
- Test in isolation with mocked dependencies
- Test all code paths (success and error)
- Test edge cases and boundary conditions
- One assertion concept per test
- Clear test names describing behavior

Example:
\`\`\`typescript
describe('PasswordService', () => {
  describe('validate', () => {
    it('should return true for valid password', () => {
      // Arrange
      const validPassword = 'Test1234';

      // Act
      const result = passwordService.validate(validPassword);

      // Assert
      expect(result).toBe(true);
    });
  });
});
\`\`\`

### 2. Integration Tests
- Test API routes with mocked services
- Verify request/response handling
- Test status codes and error messages
- Validate input/output formats

Example:
\`\`\`typescript
it('should register a user successfully', async () => {
  // Arrange
  mockAuthService.register.mockResolvedValue(mockResult);
  const request = createMockRequest('/api/auth/register', {
    method: 'POST',
    body: registerData,
  });

  // Act
  const response = await POST(request);
  const data = await response.json();

  // Assert
  expect(response.status).toBe(201);
  expect(data.success).toBe(true);
});
\`\`\`

### 3. Component Tests
- Test user interactions
- Verify rendered output
- Test accessibility
- Test responsive behavior

Example:
\`\`\`typescript
it('should call login on form submit', async () => {
  // Arrange
  render(<LoginForm onSwitchToRegister={mockFn} />);

  // Act
  await userEvent.type(emailInput, 'test@example.com');
  await userEvent.click(submitButton);

  // Assert
  expect(mockLogin).toHaveBeenCalledWith('test@example.com', expect.any(String));
});
\`\`\`

### 4. E2E Tests
- Test complete user flows
- Use real browser interactions
- Verify UI and business logic integration
- Test critical paths

Example:
\`\`\`typescript
test('user can register and login', async ({ page }) => {
  await page.goto('/auth');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'Test1234');
  await page.click('text=Sign Up');

  await expect(page).toHaveURL('/');
});
\`\`\`

## Continuous Integration

### Pre-commit Hooks
- Run linter
- Run unit tests
- Check coverage thresholds

### CI Pipeline
1. Install dependencies
2. Run linter
3. Run all unit tests
4. Run integration tests
5. Run E2E tests
6. Generate coverage report
7. Fail if coverage < 98%

## Test Data Management

### Fixtures
Located in `src/__tests__/fixtures/`:
- `users.ts` - Test user data
- `posts.ts` - Test post data
- `auth.ts` - Auth tokens and responses

### Test Database
For integration tests requiring database:
- Use separate test database
- Reset before each test suite
- Use transactions that roll back

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Test names describe expected behavior
3. **Speed**: Unit tests should run in milliseconds
4. **Reliability**: Tests should not be flaky
5. **Maintainability**: Don't test implementation details
6. **Coverage**: Aim for 98%+ on all metrics
7. **SOLID**: Tests follow same principles as code

## Debugging Tests

```bash
# Run specific test file
npm test -- PasswordService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should validate"

# Run with verbose output
npm test -- --verbose

# Update snapshots
npm test -- --updateSnapshot

# Debug in VS Code
# Add breakpoint and run "Jest: Debug"
```

## Performance Benchmarks

Target test execution times:
- Unit tests: < 5 seconds total
- Integration tests: < 30 seconds total
- E2E tests: < 2 minutes total
- Full suite: < 3 minutes total

## Test Metrics

Track these metrics:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage
- Test execution time
- Number of assertions
- Test to code ratio

## Future Enhancements

- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Load testing
- [ ] Security testing
- [ ] Accessibility testing
- [ ] Mutation testing
- [ ] Contract testing (API)

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Summary

✅ **103 unit tests passing**
✅ **99.06% coverage on service layer**
✅ **100% coverage on validation layer**
✅ **SOLID principles make testing easy**
✅ **Comprehensive test infrastructure**

**Next Steps:**
1. Complete API route integration tests
2. Complete component tests
3. Add E2E tests with Playwright
4. Achieve 98%+ coverage across all files

**Testing is not optional. Every line of code must be tested.**
