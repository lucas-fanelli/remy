/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/container/container', () => ({
  container: {
    getAuthService: jest.fn(),
    getTokenService: jest.fn(),
  },
}));

jest.mock('@/lib/utils/cookies', () => ({
  setAuthCookie: jest.fn((response) => response),
  clearAuthCookie: jest.fn((response) => response),
}));

jest.mock('@/lib/utils/auth', () => ({
  extractAuthToken: jest.fn(),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn(),
  getCurrentUser: jest.fn(),
}));

import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { setAuthCookie, clearAuthCookie } from '@/lib/utils/cookies';
import { POST as loginPOST } from '../auth/login/route';
import { POST as logoutPOST } from '../auth/logout/route';
import { GET as meGET } from '../auth/me/route';
import { POST as registerPOST } from '../auth/register/route';

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('POST /api/auth/login', () => {
  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    validateToken: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAuthService as jest.Mock).mockReturnValue(mockAuthService);
  });

  it('should return 200 with user data and set cookie on successful login', async () => {
    // Arrange
    const loginResult = {
      user: { id: 'user-1', email: 'test@example.com', username: 'testuser' },
      token: 'jwt-token-123',
    };
    mockAuthService.login.mockResolvedValue(loginResult);

    const request = createJsonRequest('http://localhost:3000/api/auth/login', {
      emailOrUsername: 'test@example.com',
      password: 'Password1',
    });

    // Act
    const response = await loginPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(loginResult);
    expect(body.message).toBe('Login successful');
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'jwt-token-123');
  });

  it('should return 401 when credentials are invalid', async () => {
    // Arrange
    mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

    const request = createJsonRequest('http://localhost:3000/api/auth/login', {
      emailOrUsername: 'test@example.com',
      password: 'WrongPass1',
    });

    // Act
    const response = await loginPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid credentials');
  });

  it('should return 400 when request body is missing or invalid JSON', async () => {
    // Arrange - request with no parseable JSON body
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    // Act
    const response = await loginPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('should return 400 when required fields fail validation', async () => {
    // Arrange - empty object fails Zod schema (emailOrUsername required)
    const request = createJsonRequest('http://localhost:3000/api/auth/login', {});

    // Act
    const response = await loginPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});

describe('POST /api/auth/register', () => {
  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    validateToken: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (container.getAuthService as jest.Mock).mockReturnValue(mockAuthService);
  });

  it('should return 201 with user data and set cookie on successful registration', async () => {
    // Arrange
    const registerResult = {
      user: { id: 'user-2', email: 'new@example.com', username: 'newuser' },
      token: 'jwt-token-456',
    };
    mockAuthService.register.mockResolvedValue(registerResult);

    const request = createJsonRequest('http://localhost:3000/api/auth/register', {
      email: 'new@example.com',
      username: 'newuser',
      password: 'Password1',
      fullName: 'New User',
    });

    // Act
    const response = await registerPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(registerResult);
    expect(body.message).toBe('User registered successfully');
    expect(setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'jwt-token-456');
  });

  it('should return 409 when email already exists', async () => {
    // Arrange
    mockAuthService.register.mockRejectedValue(new Error('User already exists'));

    const request = createJsonRequest('http://localhost:3000/api/auth/register', {
      email: 'taken@example.com',
      username: 'takenuser',
      password: 'Password1',
    });

    // Act
    const response = await registerPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain('already exists');
  });

  it('should return 400 when registration data fails validation', async () => {
    // Arrange - password too short
    const request = createJsonRequest('http://localhost:3000/api/auth/register', {
      email: 'bad@example.com',
      username: 'ba',
      password: 'short',
    });

    // Act
    const response = await registerPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and clear the auth cookie', async () => {
    // Arrange — send a request with the auth_token cookie
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: 'auth_token=some-jwt-token',
      },
    });

    // Act
    const response = await logoutPOST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Logged out successfully');
    expect(clearAuthCookie).toHaveBeenCalledWith(expect.anything());
  });

  it('should return 200 with already logged out when no cookie', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    });

    const response = await logoutPOST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Already logged out');
    expect(clearAuthCookie).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return current user when authenticated', async () => {
    // Arrange
    const mockUser = { id: 'user-1', email: 'test@example.com', username: 'testuser' };
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);

    const request = createGetRequest('http://localhost:3000/api/auth/me');

    // Act
    const response = await meGET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockUser);
  });

  it('should return 401 when not authenticated', async () => {
    // Arrange
    (requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'));

    const request = createGetRequest('http://localhost:3000/api/auth/me');

    // Act
    const response = await meGET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });
});
