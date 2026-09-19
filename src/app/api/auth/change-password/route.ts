import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { setAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';
import { changePasswordSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const user = await requireAuth(request);

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body');
    }

    // Validate input
    const validatedData = changePasswordSchema.parse(body);

    // Get auth service from container
    const authService = container.getAuthService();

    // Change password — this invalidates every session issued before now
    const token = await authService.changePassword(
      user.id,
      validatedData.oldPassword,
      validatedData.newPassword
    );

    // Re-issue this session's cookie so the user who made the change stays
    // logged in while every other session (other devices, a stolen token) dies
    const response = ApiResponseHelper.success(null, 'Password changed successfully');
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized();
    }

    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    // AuthService.changePassword reports a wrong current password with this message
    if (error instanceof Error && error.message === 'Invalid old password') {
      return ApiResponseHelper.badRequest('Current password is incorrect');
    }

    logServerError('Change password error:', error);
    return ApiResponseHelper.internalError();
  }
}
