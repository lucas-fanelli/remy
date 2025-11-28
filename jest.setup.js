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

// Suppress noisy console warnings from MUI components during tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('Warning: An update to') ||
       message.includes('inside a test was not wrapped in act') ||
       message.includes('TouchRipple'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
