import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';
import { ApiResponseHelper } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Get auth service from container
    const authService = container.getAuthService();

    // Register user
    const result = await authService.register(validatedData);

    return ApiResponseHelper.created(result, 'User registered successfully');
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return ApiResponseHelper.conflict(error.message);
      }
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Registration error:', error);
    return ApiResponseHelper.internalError();
  }
}
