import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import { cleanupCloudinaryImage } from '@/lib/utils/cloudinary-cleanup';
import { logAuditEvent, logServerError } from '@/lib/utils/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    logAuditEvent('ADMIN_RECIPE_DELETE', { admin: authResult.userId, target: id });

    const adminService = container.getAdminService();
    const { imageUrl } = await adminService.deleteRecipe(id);

    // Clean up Cloudinary image in the background (best-effort).
    // NOTE: If this fails, the image becomes orphaned. The cleanup-orphaned-images
    // script (src/scripts/cleanup-orphaned-images.ts) MUST be scheduled as a periodic
    // cron job to catch any orphans.
    if (imageUrl) {
      cleanupCloudinaryImage(imageUrl).catch((err) =>
        logServerError('Failed to delete image from Cloudinary:', err)
      );
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Recipe not found', code: 'recipe.notFound' },
        { status: 404 }
      );
    }
    logServerError('Error deleting recipe:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe', code: 'recipe.deleteFailed' },
      { status: 500 }
    );
  }
}
