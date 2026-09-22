import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/api/auth';
import { ApiResponseHelper } from '@/lib/api/response';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { canViewContentOf } from '@/lib/privacy/visibility';
import { logServerError } from '@/lib/utils/logger';

/**
 * GET /api/users/[username] — one person, as the reader may see them.
 *
 * No screen calls this; the profile page reads /profile. It is trimmed rather than left as
 * it was, because it answered anyone — signed out included — with the whole row minus the
 * email: role (which names the admins), isVerified, updatedAt, and the website of a private
 * account that its own profile page hides. Now it answers with the header every profile
 * shows, and the website only to someone the account's content is visible to.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username format', code: 'request.invalidUsername' },
        { status: 400 }
      );
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return ApiResponseHelper.notFound('User not found', 'user.notFound');
    }

    const viewer = await getCurrentUser(request);
    const header = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      bio: user.bio,
      isPrivate: user.isPrivate,
    };

    const visible = await canViewContentOf(prisma, viewer?.id ?? null, user);
    return ApiResponseHelper.success({
      user: visible ? { ...header, website: user.website, createdAt: user.createdAt } : header,
    });
  } catch (error) {
    logServerError('Get user error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
