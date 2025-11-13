import { NextRequest } from 'next/server';
import { container } from '@/lib/container/container';
import { ApiResponseHelper } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return ApiResponseHelper.notFound('User not found');
    }

    return ApiResponseHelper.success({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return ApiResponseHelper.internalError();
  }
}
