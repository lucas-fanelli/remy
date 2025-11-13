import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IUserService } from '@/domain/services/IUserService';
import { IRecipeService } from '@/domain/services/IRecipeService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const userService = container.get<IUserService>('IUserService');
    const recipeService = container.get<IRecipeService>('IRecipeService');

    // Search users by username
    const users = await userService.searchUsers(query.trim());

    // Search recipes by title
    const allRecipes = await recipeService.getAllRecipes();
    const recipes = allRecipes.filter((recipe) =>
      recipe.title.toLowerCase().includes(query.toLowerCase()) ||
      recipe.description.toLowerCase().includes(query.toLowerCase()) ||
      recipe.cuisine.toLowerCase().includes(query.toLowerCase())
    );

    return NextResponse.json({
      users: users.slice(0, 5), // Limit to 5 users
      recipes: recipes.slice(0, 5), // Limit to 5 recipes
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
