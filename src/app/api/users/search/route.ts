import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';
import { ApiResponseHelper } from '@/lib/api/response';
import { searchSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = searchParams.get('limit');

    // Validate input
    const validatedData = searchSchema.parse({ query, limit });

    // Get user service from container
    const userService = container.getUserService();

    // Search users
    const users = await userService.searchUsers(
      validatedData.query,
      validatedData.limit
    );

    return ApiResponseHelper.success(users);
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(
        error.errors.map((e) => e.message).join(', ')
      );
    }

    console.error('Search users error:', error);
    return ApiResponseHelper.internalError();
  }
}
