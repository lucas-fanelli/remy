import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IAIRecipeService } from '@/domain/services/IAIRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';

/**
 * POST /api/ai/cooking-advice - Get cooking advice from AI
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
    const { question, recipeId, step } = body;

    // Validation
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (question.length > 500) {
      return NextResponse.json(
        { error: 'Question must be less than 500 characters' },
        { status: 400 }
      );
    }

    const aiRecipeService = container.getAIRecipeService();

    // Check rate limits
    const canGenerate = await aiRecipeService.canUserGenerateRecipe(payload.userId);
    if (!canGenerate.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: canGenerate.reason,
        },
        { status: 429 }
      );
    }

    // Get cooking advice
    const advice = await aiRecipeService.getCookingAdvice(
      payload.userId,
      question,
      recipeId ? { recipeId, step } : undefined
    );

    return NextResponse.json({
      advice,
      question,
    });

  } catch (error) {
    console.error('Error getting cooking advice:', error);

    if (error instanceof Error && error.message.includes('Rate limit')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get cooking advice' },
      { status: 500 }
    );
  }
}
