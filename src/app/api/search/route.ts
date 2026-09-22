import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { IUserService } from '@/domain/services/IUserService';
import { getCurrentUser } from '@/lib/api/auth';
import { engagementCounts } from '@/lib/api/engagementCounts';
import { loadViewerState } from '@/lib/api/viewerState';
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { visiblePostsWhere } from '@/lib/privacy/visibility';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required', code: 'search.queryRequired' },
        { status: 400 }
      );
    }

    if (query.length > MAX_SEARCH_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Search query too long', code: 'search.queryTooLong' },
        { status: 400 }
      );
    }

    const userService = container.get<IUserService>('IUserService');

    // Search users by username - strip email from public results.
    // Defense-in-depth: UserRepository.search already excludes email at query level,
    // but we strip it here too in case the repository implementation changes.
    const users = (await userService.searchUsers(query.trim(), limit, offset)).map((u) => ({
      username: u.username,
      fullName: u.fullName,
      avatar: u.avatar,
      bio: u.bio,
    }));

    // Optional auth — search is open to guests. Who is reading is resolved BEFORE the recipe
    // query because it decides which recipes the search may return: a private author finds
    // their own, a stranger and a guest (null) find public authors only. It also puts the
    // reader's own hearts on the cards below.
    const requester = await getCurrentUser(request);

    // Search recipes with engagement data
    // Prisma 'contains' mode auto-escapes SQL wildcards (%, _) — no manual escaping needed
    const recipes = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } },
        ],
        // Under AND, never beside the OR above: for a signed-in reader the privacy rule is
        // itself an OR, and one object holds one OR — the text query or the rule would
        // silently drop out.
        AND: [visiblePostsWhere(requester?.id ?? null)],
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
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
    });

    // A signed-in reader's own hearts belong on these cards. Search is the surface where the
    // heart was not merely wrong but missing: it hid the actions rather than admit it did
    // not know.
    const viewerState = await loadViewerState(
      requester?.id,
      recipes.map((r) => r.id)
    );

    // Format recipes response - use cached rating values from post record
    const formattedRecipes = recipes.map((recipe) => ({
      id: recipe.id,
      // The author's user id, as every other recipe list returns it. Search omitted it, so
      // the page substituted the username — a value that can never match a user id, which
      // quietly meant "you are never the owner of a search result".
      userId: recipe.userId,
      title: recipe.title ? striptags(recipe.title) : recipe.title,
      description: recipe.description ? striptags(recipe.description) : null,
      imageUrl: recipe.imageUrl,
      difficulty: recipe.difficulty || 'medium',
      prepTime: recipe.prepTime || 0,
      cookingTime: recipe.cookingTime || 0,
      // The real value, not `|| 4`. The search page stopped inventing servings in the card
      // work, but this route kept doing it, so that fix never reached the screen.
      servings: recipe.servings,
      ...engagementCounts(recipe._count),
      averageRating: safeRating(recipe.averageRating),
      totalRatings: recipe.reviewCount ?? 0,
      author: {
        username: recipe.user.username,
        avatar: recipe.user.avatar,
      },
      viewer: viewerState(recipe.id),
    }));

    return NextResponse.json({
      users,
      recipes: formattedRecipes,
    });
  } catch (error) {
    logServerError('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search', code: 'search.failed' },
      { status: 500 }
    );
  }
}
