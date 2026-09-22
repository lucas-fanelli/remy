import { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import { UpdateRecipeDTO } from '@/domain/types/recipe';
import { getCurrentUser, requireAuth } from '@/lib/api/auth';
import { engagementCounts } from '@/lib/api/engagementCounts';
import { loadViewerState } from '@/lib/api/viewerState';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
import { loadRatingBreakdown } from '@/lib/ratings/recipeRating';
import { cleanupCloudinaryImage } from '@/lib/utils/cloudinary-cleanup';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';
import { requireJsonContentType } from '@/lib/utils/request';

/**
 * GET /api/recipes/[id] - Get a single recipe by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    // Optional auth: anyone may read a public recipe, but a private author's recipe is
    // only theirs to read. Every list endpoint filters those out; without this the direct
    // link was a way around it.
    const viewer = await getCurrentUser(request);

    // The same gate as every other door reached through a recipe id, so the recipe answers
    // exactly what its comments, rating and like answer — the same 403 body, author
    // included. It used to decide through its own copy of the rule inside RecipeService,
    // which would have kept shutting out a private author's followers after the rule
    // learned about them: canSeePost goes through canViewContentOf, the one place that
    // changes.
    const access = await canSeePost(prisma, id, viewer?.id ?? null);
    if (access.status !== 'ok') return deniedPostResponse(access);

    const recipeService = container.getRecipeService();
    const found = await recipeService.getRecipeWithCounts(id);

    // Deleted between the gate and this read.
    if (!found) {
      return NextResponse.json(
        { error: 'Recipe not found', code: 'recipe.notFound' },
        { status: 404 }
      );
    }

    const { recipe, counts } = found;

    // The page used to learn all of this from two extra requests — /like and /save — which
    // resolved after first paint, so the heart and the bookmark rendered empty and then
    // flipped. It comes with the recipe now.
    const [viewerState, ratingBreakdown] = await Promise.all([
      loadViewerState(viewer?.id, [recipe.id]),
      // How the scores are spread, so the page can show more than a mean. Names are never
      // part of it: rating stays anonymous.
      loadRatingBreakdown(prisma, recipe.id),
    ]);

    // Use cached rating values from the post record
    return NextResponse.json({
      recipe: {
        ...recipe,
        averageRating: safeRating(recipe.averageRating),
        totalRatings: recipe.totalRatings ?? 0,
        ...engagementCounts(counts),
        viewer: viewerState(recipe.id),
        ratingBreakdown,
      },
    });
  } catch (error) {
    logServerError('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe', code: 'recipe.loadFailed' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recipes/[id] - Update a recipe
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'invalidRequest' },
        { status: 400 }
      );
    }

    if (body.imageUrl) {
      const cloudinaryError = validateCloudinaryUrl(body.imageUrl);
      if (cloudinaryError) return cloudinaryError;
    }

    const updateData: UpdateRecipeDTO = body;

    // Update recipe using service (ownership check is done in service)
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.updateRecipe(id, user.id, updateData);

    return NextResponse.json({ recipe, message: 'Recipe updated successfully' }, { status: 200 });
  } catch (error) {
    logServerError('Error updating recipe:', error);

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: 'You do not have permission to update this recipe',
          code: 'recipe.updateForbidden',
        },
        { status: 403 }
      );
    }
    // RecipeService raises this one with 'Recipe not found' and nothing else
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message, code: 'recipe.notFound' }, { status: 404 });
    }
    // No code: the message is the list of fields that failed, which 'invalidRequest' would
    // throw away. It becomes translatable with the rest of the recipe validation messages.
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update recipe', code: 'recipe.updateFailed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recipes/[id] - Delete a recipe
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // Atomic ownership check + delete — returns imageUrl for Cloudinary cleanup
    const recipeService = container.getRecipeService();
    const { imageUrl } = await recipeService.deleteRecipe(id, user.id);

    // Clean up Cloudinary image after successful DB deletion (best-effort)
    if (imageUrl) {
      try {
        await cleanupCloudinaryImage(imageUrl);
      } catch (err) {
        logServerError('Failed to cleanup Cloudinary image:', err);
      }
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' }, { status: 200 });
  } catch (error) {
    logServerError('Error deleting recipe:', error);

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: 'You do not have permission to delete this recipe',
          code: 'recipe.deleteForbidden',
        },
        { status: 403 }
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message, code: 'recipe.notFound' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete recipe', code: 'recipe.deleteFailed' },
      { status: 500 }
    );
  }
}
