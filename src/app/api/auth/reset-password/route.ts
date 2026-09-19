import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { InvalidResetTokenError, ValidationError } from '@/domain/errors';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { clearAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';
import { resetPasswordSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body');
    }

    const { token, password } = resetPasswordSchema.parse(body);

    await container.getPasswordResetService().resetPassword(token, password);

    // Deliberately no automatic login: the user signs in with the new password.
    // Any session cookie in this browser predates the reset and is now rejected
    // by validateToken, so drop it instead of leaving a dead cookie behind.
    const response = ApiResponseHelper.success(null, 'Password updated. You can now log in.');
    clearAuthCookie(response);
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    // One generic answer for unknown, used and expired tokens
    if (error instanceof InvalidResetTokenError) {
      return ApiResponseHelper.badRequest(error.message);
    }

    if (error instanceof ValidationError) {
      return ApiResponseHelper.badRequest(error.message);
    }

    // Never log the request body here: it carries the token and the new password
    logServerError('Reset password error:', error);
    return ApiResponseHelper.internalError();
  }
}
