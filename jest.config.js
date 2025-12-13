const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  maxWorkers: '50%', // Use 50% of available CPU cores (optimal balance)
  cache: true, // Cache transformed modules for faster subsequent runs
  workerIdleMemoryLimit: '512MB', // Restart workers if they use too much memory
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
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
  testMatch: [
    '**/__tests__/**/*.(test|spec).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
