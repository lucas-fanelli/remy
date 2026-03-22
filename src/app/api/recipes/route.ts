import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { z, ZodError } from 'zod';
import { ValidationError } from '@/domain/errors';
import { requireAuth } from '@/lib/api/auth';
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_DAILY_RECIPES,
  PG_ADVISORY_LOCK_RECIPE_CREATE,
  UUID_REGEX,
} from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';
import { requireJsonContentType } from '@/lib/utils/request';

const ingredientSchema = z
  .object({
    name: z.string().min(1).max(200),
    amount: z.string().max(50),
    unit: z.string().max(50),
  })
  .strict();

const instructionSchema = z
  .object({
    step: z.number().int().positive(),
    description: z.string().min(1).max(5000),
    image: z
      .string()
      .url()
      .refine(
        (url) => url.startsWith('https://res.cloudinary.com/'),
        'Instruction image must be a Cloudinary URL'
      )
      .optional(),
  })
  .strict();

const createRecipeSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    imageUrl: z
      .string()
      .min(1)
      .url()
      .refine(
        (url) => url.startsWith('https://res.cloudinary.com/'),
        'Image must be a Cloudinary URL'
      ),
    cookingTime: z.number().int().min(1).max(720),
    prepTime: z.number().int().min(0).max(480),
    servings: z.number().int().min(1).max(100),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    ingredients: z.array(ingredientSchema).min(1).max(100),
    instructions: z
      .array(instructionSchema)
      .min(1)
      .max(50)
      .refine(
        (instructions) => new Set(instructions.map((i) => i.step)).size === instructions.length,
        'Instruction steps must be unique'
      ),
    caption: z.string().max(500).optional(),
  })
  .strict();

/**
 * GET /api/recipes - Fetch recipes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);
    const difficulty = searchParams.get('difficulty');
    const maxTime = searchParams.get('maxTime');
    const minTime = searchParams.get('minTime');
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    const sort = searchParams.get('sort') || 'newest';

    const validSorts = ['newest', 'rating_desc', 'rating_asc', 'most_reviewed'];
    if (sort && !validSorts.includes(sort)) {
      return NextResponse.json({ error: 'Invalid sort parameter' }, { status: 400 });
    }

    // Build Prisma where clause — exclude recipes from private users by default
    const where: Prisma.PostWhereInput = {
      user: { isPrivate: false },
    };

    if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
      return NextResponse.json({ error: 'Search query too long' }, { status: 400 });
    }

    if (query) {
      // Prisma 'contains' mode auto-escapes SQL wildcards (%, _) — no manual escaping needed
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (difficulty) {
      const validDifficulties = ['easy', 'medium', 'hard'];
      if (!validDifficulties.includes(difficulty)) {
        return NextResponse.json(
          { error: 'Invalid difficulty. Must be: easy, medium, hard' },
          { status: 400 }
        );
      }
      where.difficulty = difficulty;
    }

    // Time filtering - both maxTime and minTime can be applied together
    if (maxTime || minTime) {
      where.cookingTime = {};
      if (maxTime) {
        const parsed = parseInt(maxTime);
        if (!isNaN(parsed)) where.cookingTime.lte = parsed;
      }
      if (minTime) {
        const parsed = parseInt(minTime);
        if (!isNaN(parsed)) where.cookingTime.gte = parsed;
      }
    }

    if (userId) {
      if (!UUID_REGEX.test(userId)) {
        return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
      }
      where.userId = userId;
    }

    // Determine sort order based on sort parameter
    let orderBy: Prisma.PostOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }]; // Default: Newest
    switch (sort) {
      case 'rating_desc':
        orderBy = [
          { averageRating: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ];
        break;
      case 'rating_asc':
        orderBy = [
          { averageRating: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ];
        break;
      case 'most_reviewed':
        orderBy = [{ reviewCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
        break;
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }, { id: 'asc' }];
        break;
    }

    // Fetch recipes and total count in parallel
    const [recipes, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ]);

    // Transform to expected format with author and ratings
    const recipesWithRatings = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      userId: recipe.userId,
      cookingTime: recipe.cookingTime || 0,
      prepTime: recipe.prepTime || 0,
      servings: recipe.servings || 1,
      difficulty: recipe.difficulty || 'easy',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      caption: recipe.caption,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      author: recipe.user
        ? {
            username: recipe.user.username,
            fullName: recipe.user.fullName,
            avatar: recipe.user.avatar,
          }
        : undefined,
      averageRating: safeRating(recipe.averageRating),
      totalRatings: recipe.reviewCount,
      likeCount: recipe._count.likes,
      commentCount: recipe._count.comments,
    }));

    return NextResponse.json({
      recipes: recipesWithRatings,
      count: recipesWithRatings.length,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logServerError('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

/**
 * POST /api/recipes - Create a new recipe
 */
export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let validated;
    try {
      validated = createRecipeSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]?.message || 'Invalid request body';
        return NextResponse.json({ error: firstIssue }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (validated.imageUrl) {
      const cloudinaryError = validateCloudinaryUrl(validated.imageUrl);
      if (cloudinaryError) return cloudinaryError;
    }

    // Validate instruction images against Cloudinary
    for (const instruction of validated.instructions) {
      if (instruction.image) {
        const cloudinaryError = validateCloudinaryUrl(instruction.image);
        if (cloudinaryError) return cloudinaryError;
      }
    }

    // Explicit field list + sanitization to prevent mass assignment and stored XSS
    const stripHtml = (s: string) => striptags(s).trim();
    const sanitizedIngredients = validated.ingredients.map((i) => ({
      name: stripHtml(i.name),
      amount: stripHtml(i.amount),
      unit: stripHtml(i.unit),
    }));
    const sanitizedInstructions = validated.instructions.map((i) => ({
      step: i.step,
      description: stripHtml(i.description),
      image: i.image,
    }));
    const recipeData = {
      title: stripHtml(validated.title),
      description: stripHtml(validated.description),
      imageUrl: validated.imageUrl,
      cookingTime: validated.cookingTime,
      prepTime: validated.prepTime,
      servings: validated.servings,
      difficulty: validated.difficulty,
      ingredients: sanitizedIngredients,
      instructions: sanitizedInstructions,
      caption: validated.caption ? stripHtml(validated.caption) : undefined,
      userId: user.id,
    };

    // Validate via the service (does not hit DB)
    const recipeService = container.getRecipeService();
    const validationResult = await recipeService.validateRecipeData(recipeData);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: `Recipe validation failed: ${validationResult.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const recipe = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_RECIPE_CREATE}, hashtext(${user.id}))`;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailyPostCount = await tx.post.count({
        where: { userId: user.id, createdAt: { gte: twentyFourHoursAgo } },
      });
      if (dailyPostCount >= MAX_DAILY_RECIPES) {
        throw new Error('DAILY_LIMIT_REACHED');
      }

      return tx.post.create({
        data: recipeData,
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          cookingTime: true,
          prepTime: true,
          servings: true,
          difficulty: true,
          ingredients: true,
          instructions: true,
          caption: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      });
    });

    return NextResponse.json({ recipe, message: 'Recipe created successfully' }, { status: 201 });
  } catch (error) {
    logServerError('Error creating recipe:', error);

    if (error instanceof Error) {
      if (error.message === 'DAILY_LIMIT_REACHED') {
        return NextResponse.json(
          {
            error: `Daily recipe creation limit reached (${MAX_DAILY_RECIPES} per day). Please try again tomorrow.`,
          },
          { status: 429 }
        );
      }
      // Validation errors from service layer
      if (
        error instanceof ValidationError ||
        error.message.startsWith('Recipe validation failed:')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
