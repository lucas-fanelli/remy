import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const userService = container.getUserService();

    // Get user
    const user = await userService.getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's recipes with counts
    const recipes = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    // Format recipes
    const formattedRecipes = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title || 'Untitled Recipe',
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      cuisine: recipe.cuisine || 'Other',
      difficulty: recipe.difficulty || 'medium',
      cookingTime: recipe.cookingTime,
      prepTime: recipe.prepTime,
      servings: recipe.servings,
      likesCount: recipe._count.likes,
      commentsCount: recipe._count.comments,
      createdAt: recipe.createdAt,
    }));

    return NextResponse.json({ recipes: formattedRecipes });
  } catch (error) {
    console.error('Error fetching user recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}
