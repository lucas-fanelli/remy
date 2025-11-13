import { NextRequest } from 'next/server';

export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;

  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  return request;
}

export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashed_password',
  fullName: 'Test User',
  bio: null,
  avatar: null,
  website: null,
  isVerified: false,
  isPrivate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
