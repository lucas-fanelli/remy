import { NextRequest, NextResponse } from 'next/server';
import { ApiResponseHelper } from '@/lib/api/response';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import { logServerError } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return ApiResponseHelper.notFound('User not found');
    }

    // Strip email from public response to prevent enumeration
    const { email: _email, ...publicUser } = user;
    return ApiResponseHelper.success({ user: publicUser });
  } catch (error) {
    logServerError('Get user error:', error);
    return ApiResponseHelper.internalError();
  }
}
