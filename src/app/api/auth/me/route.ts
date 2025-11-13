import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { ApiResponseHelper } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return ApiResponseHelper.success(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized();
    }

    console.error('Get current user error:', error);
    return ApiResponseHelper.internalError();
  }
}
