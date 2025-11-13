# UI Testing Configuration

## Overview
This document describes the UI testing setup for tracking component coverage and testing React components.

## Configuration

### Jest Configuration
The Jest configuration has been updated to track UI component coverage in `jest.config.js`:

```javascript
collectCoverageFrom: [
  // Core business logic - MUST have 98% coverage
  'src/domain/**/*.{ts,tsx}',
  'src/infrastructure/**/*.{ts,tsx}',
  'src/lib/validation/**/*.{ts,tsx}',
  'src/lib/container/**/*.{ts,tsx}',

  // UI Components - Track coverage
  'src/components/**/*.{ts,tsx}',
  'src/app/**/*.{ts,tsx}',
  'src/contexts/**/*.{ts,tsx}',

  // Exclude test files and Next.js specific files
  '!src/**/__tests__/**',
  '!src/**/__mocks__/**',
  '!src/**/*.d.ts',
  '!src/**/*.test.{ts,tsx}',
  '!src/**/*.spec.{ts,tsx}',
  '!src/app/layout.tsx', // Next.js root layout
  '!src/app/**/layout.tsx', // Next.js layouts
  '!src/app/**/loading.tsx', // Next.js loading states
  '!src/app/**/error.tsx', // Next.js error boundaries
],
```

## Testing Libraries

The following testing libraries are already installed:

- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom Jest matchers for DOM assertions
- **@testing-library/user-event** - User interaction simulation
- **jest** - JavaScript testing framework
- **jest-environment-jsdom** - DOM environment for Jest
- **@playwright/test** - End-to-end testing (available via `npm run test:e2e`)

## Test Structure

### Unit Tests
- Located in `__tests__` directories next to the components they test
- Named with `.test.tsx` or `.spec.tsx` extension
- Focus on isolated component behavior

### Example Test
See `src/contexts/__tests__/ThemeContext.test.tsx` for an example of how to test React components with context.

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm test:watch

# Run unit tests only
npm test:unit

# Run integration tests
npm test:integration

# Run E2E tests with Playwright
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

## Coverage Report

After running `npm test`, a coverage report is generated showing:

- **Components**: `src/components/**/*.tsx`
- **Pages**: `src/app/**/*.tsx`
- **Contexts**: `src/contexts/**/*.tsx`
- **Business Logic**: `src/domain/**/*.ts`, `src/infrastructure/**/*.ts`

## Current Test Coverage

✅ **Business Logic**: 98%+ coverage
- Services: 99%
- Validation: 100%
- Repositories: 100%

🎯 **UI Components**: Tracked (coverage to be improved)
- ThemeContext: 100% covered
- Other components: 0% (tests to be added)

## Writing UI Tests

### Basic Component Test Template

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import YourComponent from '../YourComponent';

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('YourComponent', () => {
  it('should render correctly', () => {
    renderWithTheme(<YourComponent />);

    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = jest.fn();

    renderWithTheme(<YourComponent onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Best Practices

1. **Use Testing Library queries**: `getByRole`, `getByText`, `getByLabelText` over `querySelector`
2. **Test user behavior, not implementation**: Focus on what users see and do
3. **Wrap with ThemeProvider**: Material-UI components need theme context
4. **Mock external dependencies**: Mock API calls, Next.js router, etc.
5. **Test accessibility**: Use `getByRole` to ensure components are accessible
6. **Keep tests simple**: One assertion per test when possible

## Mocking

### Next.js Router
Already mocked in `jest.setup.js`:
```javascript
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))
```

### localStorage
Already mocked in `jest.setup.js`:
```javascript
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock
```

## Next Steps

To improve UI coverage, add tests for:

1. **Navigation Component** - Test routing, menu interactions
2. **RecipeCard Component** - Test rendering, click handlers
3. **RecipeFeed Component** - Test infinite scroll, filtering
4. **Form Components** - Test validation, submission
5. **AuthContext** - Test login/logout flows

## Resources

- [React Testing Library Documentation](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [Material-UI Testing Guide](https://mui.com/material-ui/guides/testing/)
- [Playwright Documentation](https://playwright.dev/)
