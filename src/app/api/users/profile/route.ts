import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { ApiResponseHelper } from '@/lib/api/response';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

// Update profile
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = updateProfileSchema.parse(body);

    // Convert null to undefined for TypeScript compatibility
    const profileData = {
      ...validatedData,
      fullName: validatedData.fullName ?? undefined,
      bio: validatedData.bio ?? undefined,
      avatar: validatedData.avatar ?? undefined,
      website: validatedData.website ?? undefined,
    };

    // Get user service from container
    const userService = container.getUserService();

    // Update profile
    const updatedUser = await userService.updateProfile(user.id, profileData);

    return ApiResponseHelper.success(updatedUser, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized();
    }

    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error) {
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Update profile error:', error);
    return ApiResponseHelper.internalError();
  }
}

// Delete account
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get user service from container
    const userService = container.getUserService();

    // Delete user
    await userService.deleteUser(user.id);

    return ApiResponseHelper.success(null, 'Account deleted successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return ApiResponseHelper.unauthorized();
    }

    console.error('Delete user error:', error);
    return ApiResponseHelper.internalError();
  }
}
