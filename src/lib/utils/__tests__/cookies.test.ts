/**
 * @jest-environment node
 */
import { NextResponse } from 'next/server';
import { TokenService } from '@/infrastructure/services/TokenService';
import { clearAuthCookie, setAuthCookie } from '../cookies';

const payload = { userId: 'user-1', email: 'test@example.com', username: 'testuser', role: 'USER' };

describe('auth cookie', () => {
  const originalEnv = process.env;

  const setEnv = (values: Record<string, string | undefined>) => {
    process.env = { ...originalEnv, JWT_EXPIRES_IN: undefined, ...values } as NodeJS.ProcessEnv;
  };

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ['the 30 day default', undefined, 30 * 24 * 60 * 60],
    ['JWT_EXPIRES_IN', '7d', 7 * 24 * 60 * 60],
    ['the default when JWT_EXPIRES_IN is invalid', 'a while', 30 * 24 * 60 * 60],
  ])('should live exactly as long as its token with %s', (_label, expiresIn, expected) => {
    // Arrange
    setEnv({ JWT_EXPIRES_IN: expiresIn });
    const tokenService = new TokenService('test-secret');

    // Act
    const token = tokenService.generate(payload);
    const response = setAuthCookie(NextResponse.json({}), token);

    // Assert
    const claims = tokenService.verify(token);
    const tokenLifetime = (claims?.exp ?? 0) - (claims?.iat ?? 0);
    expect(tokenLifetime).toBe(expected);
    expect(response.cookies.get('auth_token')?.maxAge).toBe(tokenLifetime);
  });

  it('should keep the cookie httpOnly, secure, sameSite lax and site-wide', () => {
    // Arrange
    setEnv({ NODE_ENV: 'production' });

    // Act
    const response = setAuthCookie(NextResponse.json({}), 'token');

    // Assert
    expect(response.cookies.get('auth_token')).toMatchObject({
      value: 'token',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('should not require https in development', () => {
    setEnv({ NODE_ENV: 'development' });

    const response = setAuthCookie(NextResponse.json({}), 'token');

    expect(response.cookies.get('auth_token')?.secure).toBe(false);
  });

  it('should expire the cookie immediately when clearing it', () => {
    const response = clearAuthCookie(NextResponse.json({}));

    expect(response.cookies.get('auth_token')).toMatchObject({ value: '', maxAge: 0, path: '/' });
  });
});
