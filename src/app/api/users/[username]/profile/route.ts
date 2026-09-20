import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { loadViewerState } from '@/lib/api/viewerState';
import { USERNAME_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';

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

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username format', code: 'request.invalidUsername' },
        { status: 400 }
      );
    }

    // Pagination params for posts and saved recipes
    const { searchParams } = new URL(request.url);
    const postsLimit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('postsLimit') || '50') || 50)
    );
    const postsOffset = Math.max(0, parseInt(searchParams.get('postsOffset') || '0') || 0);
    const savedLimit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('savedLimit') || '50') || 50)
    );
    const savedOffset = Math.max(0, parseInt(searchParams.get('savedOffset') || '0') || 0);

    // Get authorization token (optional)
    const token = extractAuthToken(request);
    let currentUserId: string | null = null;

    if (token) {
      try {
        const payload = await verifySessionToken(token);
        if (payload) {
          currentUserId = payload.userId;
        }
      } catch (error) {
        // Expected JWT failures (expired, malformed) are fine — continue unauthenticated.
        // Log unexpected errors so DI/config issues aren't silently swallowed.
        const isExpectedJwtError =
          error instanceof Error &&
          (error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError');
        if (!isExpectedJwtError) {
          logServerError('Unexpected error during token verification:', error);
        }
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
        isPrivate: true,
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
          take: postsLimit,
          skip: postsOffset,
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            difficulty: true,
            cookingTime: true,
            prepTime: true,
            servings: true,
            averageRating: true,
            reviewCount: true,
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
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    const isOwnProfile = currentUserId === user.id;

    // Enforce privacy - return limited info for private profiles viewed by non-owners
    if (user.isPrivate && !isOwnProfile) {
      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          bio: user.bio,
          isPrivate: true,
        },
        recipes: [],
        isOwnProfile: false,
        isPrivateProfile: true,
      });
    }

    // Build response with parallel queries for conditional data
    let isFollowing: boolean | undefined = undefined;
    let savedRecipes: unknown[] | undefined = undefined;
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
    }

    // Get saved recipes (if own profile)
    if (isOwnProfile && currentUserId) {
      savedRecipesPromise = prisma.savedRecipe
        .findMany({
          where: { userId: currentUserId },
          take: savedLimit,
          skip: savedOffset,
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
                averageRating: true,
                reviewCount: true,
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
        .then((saved) =>
          saved.map((s) => ({
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
            averageRating: safeRating(s.post.averageRating),
            totalRatings: s.post.reviewCount ?? 0,
            author: {
              username: s.post.user.username,
              avatar: s.post.user.avatar,
            },
          }))
        );
    }

    // Run conditional queries in parallel
    const [isFollowingResult, savedRecipesResult] = await Promise.all([
      isFollowingPromise ?? Promise.resolve(undefined),
      savedRecipesPromise ?? Promise.resolve(undefined),
    ]);
    if (isFollowingResult !== undefined) isFollowing = isFollowingResult;
    if (savedRecipesResult !== undefined) savedRecipes = savedRecipesResult;

    // One batch for both lists: the recipes this profile published and, on your own
    // profile, the ones you saved. A reader looking at someone else's profile has their own
    // hearts on those cards, which is why this is keyed on the reader and not on the owner.
    const savedList = (savedRecipes ?? []) as { id: string }[];
    const viewerState = await loadViewerState(currentUserId, [
      ...user.posts.map((p) => p.id),
      ...savedList.map((r) => r.id),
    ]);

    // Format recipes using cached rating values from post record
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
      averageRating: safeRating(recipe.averageRating),
      totalRatings: recipe.reviewCount ?? 0,
      viewer: viewerState(recipe.id),
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

    // Add conditional data (already resolved from Promise.all above)
    if (isFollowing !== undefined) {
      response.isFollowing = isFollowing;
    }

    if (savedRecipes !== undefined) {
      // `viewer.saved` is true for every one of these by definition — this is the saved
      // list. It is attached anyway so the card here takes the same props as the card
      // anywhere else, instead of the tab's own membership standing in for the state.
      response.savedRecipes = savedList.map((recipe) => ({
        ...recipe,
        viewer: viewerState(recipe.id),
      }));
    }

    return NextResponse.json(response);
  } catch (error) {
    logServerError('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile', code: 'user.profileFailed' },
      { status: 500 }
    );
  }
}
