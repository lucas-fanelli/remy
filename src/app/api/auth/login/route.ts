import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { loginSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);

    // Get auth service from container
    const authService = container.getAuthService();

    // Login user
    const result = await authService.login(validatedData);

    return ApiResponseHelper.success(result, 'Login successful');
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid credentials')) {
        return ApiResponseHelper.unauthorized(error.message);
      }
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Login error:', error);
    return ApiResponseHelper.internalError();
  }
}
