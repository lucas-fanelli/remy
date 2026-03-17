import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

/**
 * GET /api/users/[username]/profile - Combined profile endpoint
 *
 * Returns ALL profile data in a single request:
 * - User info
 * - Stats (recipes, followers, following counts)
 * - User's recipes
 * - Is following status (if authenticated)
 * - Saved recipes (if own profile and authenticated)
 *
 * This replaces 4-5 separate API calls with ONE, dramatically improving load time.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get authorization token (optional)
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const tokenService = container.getTokenService();
        const payload = tokenService.verify(token);
        if (payload) {
          currentUserId = payload.userId;
        }
      } catch {
        // Token verification failed - continue without authentication
        // This allows viewing profiles without being logged in
      }
    }

    // Single query to get user with all related data
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatar: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
        posts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            difficulty: true,
            cookingTime: true,
            prepTime: true,
            servings: true,
            createdAt: true,
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwnProfile = currentUserId === user.id;

    // Build response with parallel queries for conditional data
    const conditionalQueries: Promise<unknown>[] = [];
    let isFollowingPromise: Promise<boolean> | null = null;
    let savedRecipesPromise: Promise<unknown[]> | null = null;

    // Check if following (if logged in and not own profile)
    if (currentUserId && !isOwnProfile) {
      isFollowingPromise = prisma.follow
        .findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: user.id,
            },
          },
        })
        .then((follow) => !!follow);
      conditionalQueries.push(isFollowingPromise);
    }

    // Get saved recipes (if own profile)
    if (isOwnProfile && currentUserId) {
      savedRecipesPromise = prisma.savedRecipe
        .findMany({
          where: { userId: currentUserId },
          include: {
            post: {
              select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
                difficulty: true,
                cookingTime: true,
                prepTime: true,
                servings: true,
                createdAt: true,
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
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        .then(async (saved) => {
          // Get ratings for all saved recipe posts
          const postIds = saved.map((s) => s.post.id);
          const ratings = await prisma.rating.groupBy({
            by: ['postId'],
            where: { postId: { in: postIds } },
            _avg: { rating: true },
            _count: { rating: true },
          });
          const ratingsMap = new Map(
            ratings.map((r) => [
              r.postId,
              {
                averageRating: r._avg.rating || 0,
                totalRatings: r._count.rating || 0,
              },
            ])
          );

          return saved.map((s) => ({
            id: s.post.id,
            title: s.post.title,
            description: s.post.description,
            imageUrl: s.post.imageUrl,
            difficulty: s.post.difficulty || 'medium',
            cookingTime: s.post.cookingTime,
            prepTime: s.post.prepTime,
            servings: s.post.servings,
            likesCount: s.post._count.likes,
            commentsCount: s.post._count.comments,
            createdAt: s.post.createdAt,
            averageRating: ratingsMap.get(s.post.id)?.averageRating || 0,
            totalRatings: ratingsMap.get(s.post.id)?.totalRatings || 0,
            author: {
              username: s.post.user.username,
              avatar: s.post.user.avatar,
            },
          }));
        });
      conditionalQueries.push(savedRecipesPromise);
    }

    // Get ratings for user's recipes in parallel with conditional queries
    const recipeIds = user.posts.map((r) => r.id);
    const ratingsPromise = prisma.rating.groupBy({
      by: ['postId'],
      where: { postId: { in: recipeIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const results = await Promise.all([...conditionalQueries, ratingsPromise]);
    const recipeRatings = results[results.length - 1] as Array<{
      postId: string;
      _avg: { rating: number | null };
      _count: { rating: number };
    }>;
    const recipeRatingsMap = new Map(
      recipeRatings.map((r) => [
        r.postId,
        {
          averageRating: r._avg.rating || 0,
          totalRatings: r._count.rating || 0,
        },
      ])
    );

    // Format recipes
    const recipes = user.posts.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      difficulty: recipe.difficulty || 'medium',
      cookingTime: recipe.cookingTime,
      prepTime: recipe.prepTime,
      servings: recipe.servings,
      likesCount: recipe._count.likes,
      commentsCount: recipe._count.comments,
      createdAt: recipe.createdAt,
      averageRating: recipeRatingsMap.get(recipe.id)?.averageRating || 0,
      totalRatings: recipeRatingsMap.get(recipe.id)?.totalRatings || 0,
    }));

    // Build response
    const response: Record<string, unknown> = {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        avatar: user.avatar,
        website: user.website,
        createdAt: user.createdAt,
      },
      stats: {
        recipesCount: user._count.posts,
        followersCount: user._count.followers,
        followingCount: user._count.following,
      },
      recipes,
      isOwnProfile,
    };

    // Add conditional data
    if (isFollowingPromise) {
      response.isFollowing = await isFollowingPromise;
    }

    if (savedRecipesPromise) {
      response.savedRecipes = await savedRecipesPromise;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
