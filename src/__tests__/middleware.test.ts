/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

let ipCounter = 0;
/** A fresh client IP per test keeps the in-memory rate-limit buckets independent */
const nextIp = () => `203.0.113.${++ipCounter}`;

function post(pathname: string, ip: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      'x-forwarded-for': ip,
      ...headers,
    },
  });
}

describe('middleware - password recovery endpoints', () => {
  it.each([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ])('should apply the strict auth rate limit to %s', async (pathname) => {
    const response = await middleware(post(pathname, nextIp()));

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('should keep the default rate limit for other API routes', async () => {
    const response = await middleware(post('/api/auth/logout', nextIp()));

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('should answer 429 once a client exceeds 10 forgot-password requests in the window', async () => {
    // Arrange
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      await middleware(post('/api/auth/forgot-password', ip));
    }

    // Act
    const response = await middleware(post('/api/auth/forgot-password', ip));

    // Assert
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
  });

  it('should share one strict bucket between forgot-password and reset-password', async () => {
    // Arrange
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      await middleware(post('/api/auth/forgot-password', ip));
    }

    // Act
    const response = await middleware(post('/api/auth/reset-password', ip));

    // Assert
    expect(response.status).toBe(429);
  });

  it('should reject a forgot-password POST that lacks the CSRF headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp() },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });
});
