import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { clearAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';
import { updateProfileSchema } from '@/lib/validation/schemas';

// Update profile
export async function PUT(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const user = await requireAuth(request);

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body', 'invalidRequest');
    }

    // Validate input
    const validatedData = updateProfileSchema.parse(body);

    // Validate avatar URL is a Cloudinary URL if provided
    if (validatedData.avatar) {
      const cloudinaryError = validateCloudinaryUrl(validatedData.avatar);
      if (cloudinaryError) return cloudinaryError;
    }

    // Explicit allowlist of updatable fields to prevent mass assignment if schema drifts
    const { fullName, avatar, bio, website, isPrivate } = validatedData;
    const profileData = { fullName, avatar, bio, website, isPrivate };

    // Get user service from container
    const userService = container.getUserService();

    // Update profile
    const updatedUser = await userService.updateProfile(user.id, profileData);

    return ApiResponseHelper.success(updatedUser, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized(undefined, 'unauthorized');
    }

    // No code: these are the per-field zod messages, and the generic 'invalidRequest'
    // sentence would say less than the English it would replace
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    logServerError('Update profile error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}

// Delete account
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get user service from container
    const userService = container.getUserService();

    // Delete user — CASCADE deletes all related records (posts, comments, likes, ratings,
    // follows, notifications, pantry — see schema.prisma onDelete: Cascade).
    // Cloudinary image cleanup is handled by the cleanup-orphaned-images cron script
    // (src/scripts/cleanup-orphaned-images.ts), which scans for images not referenced in the DB.
    await userService.deleteUser(user.id);

    const response = ApiResponseHelper.success(null, 'Account deleted successfully');
    clearAuthCookie(response);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized(undefined, 'unauthorized');
    }

    logServerError('Delete user error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
