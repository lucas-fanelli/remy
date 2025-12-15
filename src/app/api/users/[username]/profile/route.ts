import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/database/prisma';
import { container } from '@/lib/container/container';

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
            const token = authHeader.replace('Bearer ', '');
            const tokenService = container.getTokenService();
            const payload = tokenService.verify(token);
            if (payload) {
                currentUserId = payload.userId;
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
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const isOwnProfile = currentUserId === user.id;

        // Build response with parallel queries for conditional data
        const conditionalQueries: Promise<unknown>[] = [];
        let isFollowingPromise: Promise<boolean> | null = null;
        let savedRecipesPromise: Promise<unknown[]> | null = null;

        // Check if following (if logged in and not own profile)
        if (currentUserId && !isOwnProfile) {
            isFollowingPromise = prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: user.id,
                    },
                },
            }).then(follow => !!follow);
            conditionalQueries.push(isFollowingPromise);
        }

        // Get saved recipes (if own profile)
        if (isOwnProfile && currentUserId) {
            savedRecipesPromise = prisma.savedRecipe.findMany({
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
                            _count: {
                                select: {
                                    likes: true,
                                    comments: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { savedAt: 'desc' },
            }).then(saved => saved.map(s => ({
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
            })));
            conditionalQueries.push(savedRecipesPromise);
        }

        // Wait for conditional queries
        await Promise.all(conditionalQueries);

        // Format recipes
        const recipes = user.posts.map(recipe => ({
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
        return NextResponse.json(
            { error: 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}
