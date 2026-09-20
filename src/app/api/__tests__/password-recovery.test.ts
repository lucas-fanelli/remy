/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
jest.mock('@/lib/container/container', () => ({
  container: {
    getPasswordResetService: jest.fn(),
  },
}));

jest.mock('@/lib/utils/cookies', () => ({
  setAuthCookie: jest.fn((response) => response),
  clearAuthCookie: jest.fn((response) => response),
}));

jest.mock('@/lib/utils/logger', () => ({
  logServerError: jest.fn(),
}));

// after() needs a real request scope; here the deferred work is captured so each
// test decides when (and whether) it runs — exactly like "after the response".
const mockDeferredTasks: Array<() => unknown> = [];
jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn((task: () => unknown) => {
    mockDeferredTasks.push(task);
  }),
}));

import { InvalidResetTokenError, ValidationError } from '@/domain/errors';
import { container } from '@/lib/container/container';
import { clearAuthCookie, setAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';
import { POST as forgotPOST } from '../auth/forgot-password/route';
import { POST as resetPOST } from '../auth/reset-password/route';

function createJsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const FORGOT_URL = 'http://localhost:3000/api/auth/forgot-password';
const RESET_URL = 'http://localhost:3000/api/auth/reset-password';

const runDeferredTasks = async () => {
  for (const task of mockDeferredTasks.splice(0)) await task();
};

describe('POST /api/auth/forgot-password', () => {
  const mockService = { requestReset: jest.fn(), resetPassword: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeferredTasks.length = 0;
    mockService.requestReset.mockResolvedValue(undefined);
    (container.getPasswordResetService as jest.Mock).mockReturnValue(mockService);
  });

  it('should answer 200 with the generic body', async () => {
    // Act
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: 'chef' }));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: null,
      message:
        'If an account matches, we sent a link to reset the password. It expires in 60 minutes.',
    });
  });

  it('should answer with the same status and body for existing and unknown accounts', async () => {
    // Arrange - the service resolves the same way in both cases; an "existing" account
    // is simulated by slow work, an unknown one by an immediate return
    mockService.requestReset
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)))
      .mockImplementationOnce(() => Promise.resolve());

    // Act
    const existing = await forgotPOST(
      createJsonRequest(FORGOT_URL, { emailOrUsername: 'chef@example.com' })
    );
    const unknown = await forgotPOST(
      createJsonRequest(FORGOT_URL, { emailOrUsername: 'nobody@example.com' })
    );

    // Assert
    expect(existing.status).toBe(unknown.status);
    expect(await existing.text()).toBe(await unknown.text());
    await runDeferredTasks();
    expect(mockService.requestReset).toHaveBeenCalledTimes(2);
  });

  it('should respond before doing any account work', async () => {
    // Act
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: 'chef' }));

    // Assert - nothing account-dependent has run when the response is ready
    expect(response.status).toBe(200);
    expect(mockService.requestReset).not.toHaveBeenCalled();
    expect(mockDeferredTasks).toHaveLength(1);
  });

  it('should hand the trimmed identifier to the reset service after the response', async () => {
    // Arrange
    await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: '  chef  ' }));

    // Act
    await runDeferredTasks();

    // Assert
    expect(mockService.requestReset).toHaveBeenCalledWith('chef');
  });

  it('should log and swallow failures of the deferred work', async () => {
    // Arrange
    const failure = new Error('db down');
    mockService.requestReset.mockRejectedValue(failure);
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: 'chef' }));

    // Act + Assert
    await expect(runDeferredTasks()).resolves.toBeUndefined();
    expect(response.status).toBe(200);
    expect(logServerError).toHaveBeenCalledWith('Forgot password error:', failure);
  });

  it('should ignore a forged Host header: the route never passes the request to the service', async () => {
    // Arrange
    const request = createJsonRequest(
      FORGOT_URL,
      { emailOrUsername: 'chef' },
      { Host: 'evil.example', 'X-Forwarded-Host': 'evil.example' }
    );

    // Act
    await forgotPOST(request);
    await runDeferredTasks();

    // Assert - the only input that reaches the service is the identifier
    expect(mockService.requestReset.mock.calls[0]).toEqual(['chef']);
  });

  it('should return 400 when emailOrUsername is missing', async () => {
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, {}));

    expect(response.status).toBe(400);
    expect(mockDeferredTasks).toHaveLength(0);
  });

  it('should return 400 when emailOrUsername is blank', async () => {
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: '   ' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Email or username is required');
  });

  it('should return 400 for an invalid JSON body', async () => {
    const request = new NextRequest(FORGOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const response = await forgotPOST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid JSON body');
  });

  it('should return 415 when the content type is not JSON', async () => {
    const request = new NextRequest(FORGOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'emailOrUsername=chef',
    });

    const response = await forgotPOST(request);

    expect(response.status).toBe(415);
  });

  it('should return 500 when the work cannot even be scheduled', async () => {
    // Arrange
    const { after } = jest.requireMock('next/server');
    (after as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no request scope');
    });

    // Act
    const response = await forgotPOST(createJsonRequest(FORGOT_URL, { emailOrUsername: 'chef' }));

    // Assert
    expect(response.status).toBe(500);
  });
});

describe('POST /api/auth/reset-password', () => {
  const mockService = { requestReset: jest.fn(), resetPassword: jest.fn() };
  const validBody = { token: 'raw-token', password: 'NewPassword1' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.resetPassword.mockResolvedValue(undefined);
    (container.getPasswordResetService as jest.Mock).mockReturnValue(mockService);
  });

  it('should return 200 when the password is reset', async () => {
    // Act
    const response = await resetPOST(createJsonRequest(RESET_URL, validBody));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockService.resetPassword).toHaveBeenCalledWith('raw-token', 'NewPassword1');
  });

  it('should not log the user in automatically', async () => {
    await resetPOST(createJsonRequest(RESET_URL, validBody));

    expect(setAuthCookie).not.toHaveBeenCalled();
  });

  it('should clear the stale session cookie of the browser that did the reset', async () => {
    await resetPOST(createJsonRequest(RESET_URL, validBody));

    expect(clearAuthCookie).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unknown', 'never-issued'],
    ['used', 'already-used'],
    ['expired', 'too-old'],
  ])('should return the one generic 400 for an %s token', async (_kind, token) => {
    // Arrange - the service throws the same error for the three cases
    mockService.resetPassword.mockRejectedValue(new InvalidResetTokenError());

    // Act
    const response = await resetPOST(createJsonRequest(RESET_URL, { ...validBody, token }));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    // The same code for the three cases, for the same reason as the same sentence: a code
    // per case would tell the caller whether the token exists
    expect(body).toEqual({
      success: false,
      error: 'This reset link is invalid or has expired',
      code: 'auth.invalidResetToken',
    });
  });

  it('should not clear the session cookie when the token is rejected', async () => {
    mockService.resetPassword.mockRejectedValue(new InvalidResetTokenError());

    await resetPOST(createJsonRequest(RESET_URL, validBody));

    expect(clearAuthCookie).not.toHaveBeenCalled();
  });

  it.each([
    ['shorter than 8 characters', 'Ab1', 'Password must be at least 8 characters'],
    ['without an uppercase letter', 'password1', 'at least one uppercase letter'],
    ['without a lowercase letter', 'PASSWORD1', 'at least one lowercase letter'],
    ['without a number', 'Passwordd', 'at least one number'],
    ['longer than 128 characters', `Aa1${'x'.repeat(126)}`, 'at most 128 characters'],
  ])('should return 400 for a password %s', async (_case, password, message) => {
    // Act
    const response = await resetPOST(
      createJsonRequest(RESET_URL, { token: 'raw-token', password })
    );
    const body = await response.json();

    // Assert - same rules as registration, rejected before the service is reached
    expect(response.status).toBe(400);
    expect(body.error).toContain(message);
    expect(mockService.resetPassword).not.toHaveBeenCalled();
  });

  it('should return 400 when the token is missing', async () => {
    const response = await resetPOST(createJsonRequest(RESET_URL, { password: 'NewPassword1' }));

    expect(response.status).toBe(400);
    expect(mockService.resetPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['longer than 256 characters', 'a'.repeat(257)],
  ])(
    'should answer a %s token exactly like an unknown one so the client shows its invalid-link state',
    async (_case, token) => {
      // Arrange - what the service answers for an unknown token
      mockService.resetPassword.mockRejectedValueOnce(new InvalidResetTokenError());
      const unknown = await resetPOST(createJsonRequest(RESET_URL, validBody));

      // Act
      const malformed = await resetPOST(
        createJsonRequest(RESET_URL, { token, password: 'NewPassword1' })
      );

      // Assert
      expect(malformed.status).toBe(unknown.status);
      expect(await malformed.json()).toEqual(await unknown.json());
    }
  );

  it('should answer with the invalid-link error alone when the password is invalid too', async () => {
    const response = await resetPOST(
      createJsonRequest(RESET_URL, { token: 'a'.repeat(257), password: 'weak' })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('This reset link is invalid or has expired');
  });

  it('should return 400 when the service rejects the password', async () => {
    mockService.resetPassword.mockRejectedValue(new ValidationError('Password is not acceptable'));

    const response = await resetPOST(createJsonRequest(RESET_URL, validBody));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Password is not acceptable');
  });

  it('should return 400 for an invalid JSON body', async () => {
    const request = new NextRequest(RESET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const response = await resetPOST(request);

    expect(response.status).toBe(400);
  });

  it('should return 415 when the content type is not JSON', async () => {
    const request = new NextRequest(RESET_URL, { method: 'POST', body: 'x' });

    const response = await resetPOST(request);

    expect(response.status).toBe(415);
  });

  it('should return 500 without leaking details on unexpected errors', async () => {
    // Arrange
    mockService.resetPassword.mockRejectedValue(new Error('connection string: postgres://secret'));

    // Act
    const response = await resetPOST(createJsonRequest(RESET_URL, validBody));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Internal server error', code: 'serverError' });
  });

  it('should never log the token or the new password', async () => {
    // Arrange
    mockService.resetPassword.mockRejectedValue(new Error('boom'));

    // Act
    await resetPOST(createJsonRequest(RESET_URL, validBody));

    // Assert
    const logged = JSON.stringify((logServerError as jest.Mock).mock.calls);
    expect(logged).not.toContain('raw-token');
    expect(logged).not.toContain('NewPassword1');
  });
});
