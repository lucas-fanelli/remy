import '@testing-library/jest-dom'

// Mock Next.js router
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

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock fetch
global.fetch = jest.fn()

// Suppress noisy console output from tests
const originalError = console.error
const originalLog = console.log

beforeAll(() => {
  // Suppress noisy MUI warnings
  console.error = (...args) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('Warning: An update to') ||
       message.includes('inside a test was not wrapped in act') ||
       message.includes('TouchRipple') ||
       message.includes('Error changing password:') ||
       message.includes('Error updating recipe:') ||
       message.includes('Search error:'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }

  // Suppress debug console.log statements
  console.log = (...args) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      message.startsWith('Navigation:')
    ) {
      return
    }
    originalLog.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.log = originalLog
})
