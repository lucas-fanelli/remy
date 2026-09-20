/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { getAppBaseUrl } from '../appUrl';

describe('getAppBaseUrl', () => {
  const originalEnv = process.env;

  // Every case starts from a clean slate: whatever the developer's own .env
  // defines for these two variables must not leak into the assertions
  const setEnv = (values: Record<string, string | undefined>) => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      ...values,
    } as NodeJS.ProcessEnv;
  };

  beforeEach(() => {
    setEnv({ NODE_ENV: 'production' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should use NEXT_PUBLIC_APP_URL when it is set', () => {
    setEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://remy-recipes.com' });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
  });

  it('should reduce NEXT_PUBLIC_APP_URL to its origin', () => {
    setEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: ' https://remy-recipes.com/some/path/ ',
    });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
  });

  it('should prefer NEXT_PUBLIC_APP_URL over the Vercel production URL', () => {
    setEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://remy-recipes.com',
      VERCEL_PROJECT_PRODUCTION_URL: 'remy.vercel.app',
    });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
  });

  it('should fall back to https://VERCEL_PROJECT_PRODUCTION_URL', () => {
    setEnv({ NODE_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'remy-recipes.com' });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
  });

  it('should fall back to the Vercel URL when NEXT_PUBLIC_APP_URL is not a valid http(s) URL', () => {
    setEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'javascript:alert(1)',
      VERCEL_PROJECT_PRODUCTION_URL: 'remy-recipes.com',
    });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
  });

  it('should ignore an unparseable NEXT_PUBLIC_APP_URL', () => {
    setEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'not a url' });

    expect(getAppBaseUrl()).toBeNull();
  });

  it('should ignore a localhost NEXT_PUBLIC_APP_URL in production', () => {
    setEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      VERCEL_PROJECT_PRODUCTION_URL: 'remy-recipes.com',
    });

    expect(getAppBaseUrl()).toBe('https://remy-recipes.com');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('localhost'));
  });

  it('should accept a localhost NEXT_PUBLIC_APP_URL in development', () => {
    setEnv({ NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://localhost:3201' });

    expect(getAppBaseUrl()).toBe('http://localhost:3201');
  });

  it('should default to http://localhost:3000 in development', () => {
    setEnv({ NODE_ENV: 'development' });

    expect(getAppBaseUrl()).toBe('http://localhost:3000');
  });

  it('should return null in production when nothing is configured', () => {
    expect(getAppBaseUrl()).toBeNull();
  });

  it('should return null outside development when nothing is configured', () => {
    setEnv({ NODE_ENV: 'test' });

    expect(getAppBaseUrl()).toBeNull();
  });

  describe('host header injection', () => {
    it('should not accept a request, headers or host argument', () => {
      // A zero-argument signature is the guarantee: there is nothing to pass a Host header through
      expect(getAppBaseUrl.length).toBe(0);
    });

    it('should never read request headers in its source', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../appUrl.ts'), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

      expect(code).not.toMatch(/headers|x-forwarded|request|NextRequest|\.host\b/i);
    });

    it('should return the configured origin regardless of what a request claims', () => {
      // Arrange - an attacker-controlled Host would only ever live on a request object,
      // which this helper cannot see
      setEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://remy-recipes.com' });
      const forged = new Headers({ host: 'evil.example', 'x-forwarded-host': 'evil.example' });

      // Act
      const result = (getAppBaseUrl as (...args: unknown[]) => string | null)(forged);

      // Assert
      expect(result).toBe('https://remy-recipes.com');
    });
  });
});
