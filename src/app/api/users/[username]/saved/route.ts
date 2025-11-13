import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if requesting user is the profile owner
    if (user.id !== payload.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get saved recipes
    const savedRecipes = await prisma.savedRecipe.findMany({
      where: { userId: user.id },
      include: {
        post: {
          include: {
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format recipes
    const formattedRecipes = savedRecipes.map(({ post }) => ({
      id: post.id,
      title: post.title || 'Untitled Recipe',
      description: post.description,
      imageUrl: post.imageUrl,
      cuisine: post.cuisine || 'Other',
      difficulty: post.difficulty || 'medium',
      cookingTime: post.cookingTime,
      prepTime: post.prepTime,
      servings: post.servings,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      createdAt: post.createdAt,
    }));

    return NextResponse.json({ recipes: formattedRecipes });
  } catch (error) {
    console.error('Error fetching saved recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved recipes' },
      { status: 500 }
    );
  }
}
