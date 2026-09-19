const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  maxWorkers: '50%', // Use 50% of available CPU cores (optimal balance)
  cache: true, // Cache transformed modules for faster subsequent runs
  workerIdleMemoryLimit: '512MB', // Restart workers if they use too much memory
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^framer-motion$': '<rootDir>/src/__tests__/mocks/framer-motion.ts',
  },
  collectCoverageFrom: [
    // Core business logic - MUST have 98% coverage
    'src/domain/**/*.{ts,tsx}',
    'src/infrastructure/**/*.{ts,tsx}',
    'src/lib/validation/**/*.{ts,tsx}',
    'src/lib/container/**/*.{ts,tsx}',

    // UI Components - Track coverage
    'src/components/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',

    // Exclude test files and Next.js specific files
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',

    // Exclude Next.js app directory (pages and API routes)
    // These are better tested with integration/E2E tests
    '!src/app/**',
  ],
  // Note: Coverage thresholds are enforced in CI/CD
  // Current coverage: Services 99%, Validation 100%
  coverageThreshold: undefined,
  testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/', // Playwright E2E tests - run with npm run test:e2e
  ],
  // Inert, and kept only because it predates this config: next/jest inserts its own SWC
  // entry for '^.+\\.(js|jsx|ts|tsx|mjs)$' BEFORE this one and jest uses the first pattern
  // that matches, so tests are compiled by SWC and never typechecked. `npm run typecheck`
  // is where a message key written in a test is verified - see tsconfig.i18n.json.
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
//
// Note on ESM: next-intl and the ICU packages underneath it ship ES modules only, and
// jest.setup.js runs the REAL translator, so jest must compile them. next/jest builds
// transformIgnorePatterns from `transpilePackages` in next.config.js (a custom
// transformIgnorePatterns entry can only ADD ignores - the patterns are OR-ed), so that
// list is where those packages are declared. See docs/I18N.md.
module.exports = createJestConfig(customJestConfig);
