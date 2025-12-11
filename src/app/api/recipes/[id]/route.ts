import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IRecipeService } from '@/domain/services/IRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';
import { UpdateRecipeDTO } from '@/domain/types/recipe';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import prisma from '@/lib/database/prisma';

/**
 * GET /api/recipes/[id] - Get a single recipe by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.getRecipeById(id);

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Aggregate ratings for this recipe
    const ratingAggregation = await prisma.rating.aggregate({
      where: { postId: id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = ratingAggregation._avg.rating || 0;
    const totalRatings = ratingAggregation._count.rating || 0;

    return NextResponse.json({
      recipe: {
        ...recipe,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings,
      },
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recipes/[id] - Update a recipe
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = await tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const updateData: UpdateRecipeDTO = body;

    // Update recipe using service (ownership check is done in service)
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.updateRecipe(
      id,
      payload.userId,
      updateData
    );

    return NextResponse.json(
      { recipe, message: 'Recipe updated successfully' },
      { status: 200 }
    );
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
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }

      // Validation errors
      if (error.message.includes('validation failed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update recipe' },
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

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = await tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get recipe before deleting to access the image URL
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.getRecipeById(id);

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (recipe.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this recipe' },
        { status: 403 }
      );
    }

    // Delete the image from Cloudinary if it exists
    if (recipe.imageUrl && recipe.imageUrl.includes('cloudinary.com')) {
      try {
        // Extract public_id from Cloudinary URL
        // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
        const urlParts = recipe.imageUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
          // Get everything after 'upload/v{version}/' and remove file extension
          const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
          await deleteFromCloudinary(publicId);
          console.log(`Deleted image from Cloudinary: ${publicId}`);
        }
      } catch (fileError) {
        // Log the error but don't fail the recipe deletion
        console.warn(`Failed to delete image from Cloudinary: ${fileError}`);
      }
    }

    // Delete recipe using service
    await recipeService.deleteRecipe(id, payload.userId);

    return NextResponse.json(
      { message: 'Recipe deleted successfully' },
      { status: 200 }
    );
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
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
