import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { ApiResponseHelper } from '@/lib/api/response';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = changePasswordSchema.parse(body);

    // Get auth service from container
    const authService = container.getAuthService();

    // Change password
    await authService.changePassword(
      user.id,
      validatedData.oldPassword,
      validatedData.newPassword
    );

    return ApiResponseHelper.success(null, 'Password changed successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized();
    }

    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(
        error.errors.map((e) => e.message).join(', ')
      );
    }

    if (error instanceof Error) {
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Change password error:', error);
    return ApiResponseHelper.internalError();
  }
}
