import { NextRequest, NextResponse } from 'next/server';
import { UpdateRecipeDTO } from '@/domain/types/recipe';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

/**
 * GET /api/recipes/[id] - Get a single recipe by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.getRecipeById(id);

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Use cached rating values from the post record
    return NextResponse.json({
      recipe: {
        ...recipe,
        averageRating: recipe.averageRating ?? 0,
        totalRatings: recipe.reviewCount ?? 0,
      },
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
  }
}

/**
 * PUT /api/recipes/[id] - Update a recipe
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.imageUrl) {
      try {
        const imgUrl = new URL(body.imageUrl);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (
          imgUrl.hostname !== 'res.cloudinary.com' ||
          !cloudName ||
          !imgUrl.pathname.startsWith(`/${cloudName}/`)
        ) {
          return NextResponse.json(
            { error: 'Image must be uploaded through the app' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    const updateData: UpdateRecipeDTO = body;

    // Update recipe using service (ownership check is done in service)
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.updateRecipe(id, payload.userId, updateData);

    return NextResponse.json({ recipe, message: 'Recipe updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating recipe:', error);

    if (error instanceof Error) {
      // Check for permission errors
      if (error.message.includes('not authorized') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to update this recipe' },
          { status: 403 }
        );
      }

      // Check for not found errors
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
      }

      // Validation errors
      if (error.message.includes('validation failed')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
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

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Get minimal recipe data for Cloudinary cleanup
    const recipeForCleanup = await prisma.post.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    // Delete recipe via service (performs atomic ownership check + delete)
    const recipeService = container.getRecipeService();
    await recipeService.deleteRecipe(id, payload.userId);
    const imageUrl = recipeForCleanup?.imageUrl;

    // Clean up Cloudinary image after successful DB deletion
    if (imageUrl && imageUrl.includes('cloudinary.com')) {
      try {
        // Handle Cloudinary URLs with or without transformations
        const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
        if (match) {
          await deleteFromCloudinary(match[1]);
        }
      } catch (fileError) {
        console.warn(`Failed to delete image from Cloudinary: ${fileError}`);
      }
    }

    return NextResponse.json({ message: 'Recipe deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting recipe:', error);

    if (error instanceof Error) {
      // Check for permission errors
      if (error.message.includes('not authorized') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this recipe' },
          { status: 403 }
        );
      }

      // Check for not found errors
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 });
  }
}
