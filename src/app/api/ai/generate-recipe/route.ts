import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IAIRecipeService } from '@/domain/services/IAIRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';
import { RecipePreferences } from '@/domain/types/ai-provider';

/**
 * POST /api/ai/generate-recipe - Generate a recipe using AI
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = await tokenService.verify(token);

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { ingredients, preferences, provider } = body;

    // Validation
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'At least one ingredient is required' },
        { status: 400 }
      );
    }

    if (ingredients.length < 3) {
      return NextResponse.json(
        { error: 'Please provide at least 3 ingredients for better recipe generation' },
        { status: 400 }
      );
    }

    if (ingredients.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 ingredients allowed' },
        { status: 400 }
      );
    }

    const aiRecipeService = container.getAIRecipeService();

    // Check rate limits FIRST
    const canGenerate = await aiRecipeService.canUserGenerateRecipe(payload.userId);
    if (!canGenerate.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: canGenerate.reason,
          tier: canGenerate.tier,
          resetAt: canGenerate.resetAt,
          remaining: canGenerate.remaining,
        },
        { status: 429 }
      );
    }

    // Generate recipe
    const recipe = await aiRecipeService.generateRecipe(
      payload.userId,
      ingredients,
      preferences as RecipePreferences,
      provider
    );

    // Get remaining quota
    const quota = await aiRecipeService.getRemainingQuota(payload.userId);

    return NextResponse.json({
      recipe,
      message: 'Recipe generated successfully',
      quotaRemaining: {
        daily: quota.daily,
        monthly: quota.monthly,
        resetAt: quota.resetAt,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error generating recipe:', error);

    // Handle specific errors
    if (error instanceof Error) {
      // Rate limit errors
      if (error.message.includes('Rate limit') || error.message.includes('limit exceeded')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }

      // Provider access errors
      if (error.message.includes('subscription') || error.message.includes('access')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      // AI provider errors
      if (error.message.includes('Failed to generate') || error.message.includes('AI')) {
        return NextResponse.json(
          { error: 'AI service error. Please try again.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/generate-recipe - Get AI generation quota info
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = await tokenService.verify(token);

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const aiRecipeService = container.getAIRecipeService();

    // Get quota info
    const quota = await aiRecipeService.getRemainingQuota(payload.userId);
    const canGenerate = await aiRecipeService.canUserGenerateRecipe(payload.userId);

    return NextResponse.json({
      canGenerate: canGenerate.allowed,
      quota: {
        daily: quota.daily,
        monthly: quota.monthly,
        resetAt: quota.resetAt,
      },
      tier: canGenerate.tier,
      message: canGenerate.allowed ? 'You can generate recipes' : canGenerate.reason,
    });

  } catch (error) {
    console.error('Error fetching quota:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quota information' },
      { status: 500 }
    );
  }
}
