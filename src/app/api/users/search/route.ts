import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { logServerError } from '@/lib/utils/logger';
import { searchSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    // Absent means undefined, so the schema's default applies. The null that get() returns
    // coerces to 0, which failed `positive()`: every search without ?limit= was a 400.
    const limit = searchParams.get('limit') ?? undefined;

    // Validate input
    const validatedData = searchSchema.parse({ query, limit });

    // Get user service from container
    const userService = container.getUserService();

    // Each account's profile header, named field by field — what a locked profile shows
    // anyone, id included. Private accounts are found now, so this must be a list of what
    // goes out rather than of what stays in: the row used to be spread minus email and id,
    // and it sent the role, verification, website and dates of everyone it found.
    const users = (await userService.searchUsers(validatedData.query, validatedData.limit)).map(
      (user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        isPrivate: user.isPrivate,
      })
    );

    return ApiResponseHelper.success(users);
  } catch (error) {
    // No code: these are the per-field zod messages, and the generic 'invalidRequest'
    // sentence would say less than the English it would replace
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    logServerError('Search users error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
