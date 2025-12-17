import { AdminService } from '../../AdminService';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('AdminService - Unit Tests', () => {
    let adminService: AdminService;
    let prismaMock: DeepMockProxy<PrismaClient>;

    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        avatar: '/avatar.jpg',
        role: 'USER' as const,
        isVerified: false,
        createdAt: new Date('2024-01-01'),
        _count: {
            posts: 5,
            comments: 10,
            followers: 20,
            following: 15,
        },
    };

    const mockAdminUser = {
        ...mockUser,
        id: 'admin-123',
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'ADMIN' as const,
    };

    const mockRecipe = {
        id: 'recipe-123',
        title: 'Test Recipe',
        description: 'Test description',
        imageUrl: '/image.jpg',
        userId: 'user-123',
        createdAt: new Date('2024-01-01'),
        user: {
            username: 'testuser',
            email: 'test@example.com',
        },
        _count: {
            likes: 10,
            comments: 5,
        },
    };

    const mockComment = {
        id: 'comment-123',
        text: 'Test comment',
        postId: 'recipe-123',
        userId: 'user-123',
        createdAt: new Date('2024-01-01'),
        user: {
            username: 'testuser',
            email: 'test@example.com',
        },
        post: {
            title: 'Test Recipe',
        },
    };

    beforeEach(() => {
        prismaMock = mockDeep<PrismaClient>();
        adminService = new AdminService(prismaMock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllUsers', () => {
        it('should return users with default pagination', async () => {
            prismaMock.user.findMany.mockResolvedValue([mockUser]);
            prismaMock.user.count.mockResolvedValue(1);

            const result = await adminService.getAllUsers();

            expect(result.users).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                })
            );
        });

        it('should handle custom pagination', async () => {
            prismaMock.user.findMany.mockResolvedValue([mockUser]);
            prismaMock.user.count.mockResolvedValue(100);

            const result = await adminService.getAllUsers({ page: 3, limit: 10 });

            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 20, // (3-1) * 10
                    take: 10,
                })
            );
            expect(result.total).toBe(100);
        });

        it('should filter by search query', async () => {
            prismaMock.user.findMany.mockResolvedValue([mockUser]);
            prismaMock.user.count.mockResolvedValue(1);

            await adminService.getAllUsers({ search: 'test' });

            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: [
                            { username: { contains: 'test', mode: 'insensitive' } },
                            { email: { contains: 'test', mode: 'insensitive' } },
                            { fullName: { contains: 'test', mode: 'insensitive' } },
                        ],
                    },
                })
            );
        });

        it('should filter by role', async () => {
            prismaMock.user.findMany.mockResolvedValue([mockAdminUser]);
            prismaMock.user.count.mockResolvedValue(1);

            await adminService.getAllUsers({ role: 'ADMIN' });

            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { role: 'ADMIN' },
                })
            );
        });

        it('should combine search and role filters', async () => {
            prismaMock.user.findMany.mockResolvedValue([mockAdminUser]);
            prismaMock.user.count.mockResolvedValue(1);

            await adminService.getAllUsers({ search: 'admin', role: 'ADMIN' });

            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: expect.any(Array),
                        role: 'ADMIN',
                    },
                })
            );
        });

        it('should return empty array when no users found', async () => {
            prismaMock.user.findMany.mockResolvedValue([]);
            prismaMock.user.count.mockResolvedValue(0);

            const result = await adminService.getAllUsers();

            expect(result.users).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('promoteToAdmin', () => {
        it('should promote user to admin', async () => {
            const promotedUser = { ...mockUser, role: 'ADMIN' as const };
            prismaMock.user.update.mockResolvedValue(promotedUser);

            const result = await adminService.promoteToAdmin('user-123');

            expect(result.role).toBe('ADMIN');
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: { role: 'ADMIN' },
                select: expect.objectContaining({
                    id: true,
                    email: true,
                    username: true,
                    role: true,
                }),
            });
        });

        it('should return user with _count fields', async () => {
            prismaMock.user.update.mockResolvedValue(mockAdminUser);

            const result = await adminService.promoteToAdmin('user-123');

            expect(result._count).toBeDefined();
            expect(result._count.posts).toBe(5);
        });
    });

    describe('demoteToUser', () => {
        it('should demote admin to user', async () => {
            const demotedUser = { ...mockAdminUser, role: 'USER' as const };
            prismaMock.user.update.mockResolvedValue(demotedUser);

            const result = await adminService.demoteToUser('admin-123');

            expect(result.role).toBe('USER');
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 'admin-123' },
                data: { role: 'USER' },
                select: expect.any(Object),
            });
        });
    });

    describe('deleteUser', () => {
        it('should delete user', async () => {
            prismaMock.user.delete.mockResolvedValue(mockUser as any);

            await adminService.deleteUser('user-123');

            expect(prismaMock.user.delete).toHaveBeenCalledWith({
                where: { id: 'user-123' },
            });
        });
    });

    describe('getAllRecipes', () => {
        it('should return recipes with default pagination', async () => {
            prismaMock.post.findMany.mockResolvedValue([mockRecipe]);
            prismaMock.post.count.mockResolvedValue(1);

            const result = await adminService.getAllRecipes();

            expect(result.recipes).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 20,
                })
            );
        });

        it('should handle custom pagination', async () => {
            prismaMock.post.findMany.mockResolvedValue([mockRecipe]);
            prismaMock.post.count.mockResolvedValue(50);

            await adminService.getAllRecipes({ page: 2, limit: 10 });

            expect(prismaMock.post.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 10,
                })
            );
        });

        it('should filter by search query', async () => {
            prismaMock.post.findMany.mockResolvedValue([mockRecipe]);
            prismaMock.post.count.mockResolvedValue(1);

            await adminService.getAllRecipes({ search: 'pizza' });

            expect(prismaMock.post.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: [
                            { title: { contains: 'pizza', mode: 'insensitive' } },
                            { description: { contains: 'pizza', mode: 'insensitive' } },
                        ],
                    },
                })
            );
        });

        it('should filter by userId', async () => {
            prismaMock.post.findMany.mockResolvedValue([mockRecipe]);
            prismaMock.post.count.mockResolvedValue(1);

            await adminService.getAllRecipes({ userId: 'user-123' });

            expect(prismaMock.post.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-123' },
                })
            );
        });

        it('should return empty array when no recipes found', async () => {
            prismaMock.post.findMany.mockResolvedValue([]);
            prismaMock.post.count.mockResolvedValue(0);

            const result = await adminService.getAllRecipes();

            expect(result.recipes).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('deleteRecipe', () => {
        it('should delete recipe', async () => {
            prismaMock.post.delete.mockResolvedValue(mockRecipe as any);

            await adminService.deleteRecipe('recipe-123');

            expect(prismaMock.post.delete).toHaveBeenCalledWith({
                where: { id: 'recipe-123' },
            });
        });
    });

    describe('getAllComments', () => {
        it('should return comments with default pagination', async () => {
            prismaMock.comment.findMany.mockResolvedValue([mockComment]);
            prismaMock.comment.count.mockResolvedValue(1);

            const result = await adminService.getAllComments();

            expect(result.comments).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 20,
                })
            );
        });

        it('should handle custom pagination', async () => {
            prismaMock.comment.findMany.mockResolvedValue([mockComment]);
            prismaMock.comment.count.mockResolvedValue(100);

            await adminService.getAllComments({ page: 5, limit: 10 });

            expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 40,
                    take: 10,
                })
            );
        });

        it('should filter by postId', async () => {
            prismaMock.comment.findMany.mockResolvedValue([mockComment]);
            prismaMock.comment.count.mockResolvedValue(1);

            await adminService.getAllComments({ postId: 'recipe-123' });

            expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { postId: 'recipe-123' },
                })
            );
        });

        it('should filter by userId', async () => {
            prismaMock.comment.findMany.mockResolvedValue([mockComment]);
            prismaMock.comment.count.mockResolvedValue(1);

            await adminService.getAllComments({ userId: 'user-123' });

            expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-123' },
                })
            );
        });

        it('should combine postId and userId filters', async () => {
            prismaMock.comment.findMany.mockResolvedValue([mockComment]);
            prismaMock.comment.count.mockResolvedValue(1);

            await adminService.getAllComments({
                postId: 'recipe-123',
                userId: 'user-123',
            });

            expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        postId: 'recipe-123',
                        userId: 'user-123',
                    },
                })
            );
        });

        it('should return empty array when no comments found', async () => {
            prismaMock.comment.findMany.mockResolvedValue([]);
            prismaMock.comment.count.mockResolvedValue(0);

            const result = await adminService.getAllComments();

            expect(result.comments).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('deleteComment', () => {
        it('should delete comment', async () => {
            prismaMock.comment.delete.mockResolvedValue(mockComment as any);

            await adminService.deleteComment('comment-123');

            expect(prismaMock.comment.delete).toHaveBeenCalledWith({
                where: { id: 'comment-123' },
            });
        });
    });

    describe('getStats', () => {
        it('should return all statistics', async () => {
            prismaMock.user.count
                .mockResolvedValueOnce(100) // totalUsers
                .mockResolvedValueOnce(5) // totalAdmins
                .mockResolvedValueOnce(10); // newUsersToday

            prismaMock.post.count
                .mockResolvedValueOnce(50) // totalRecipes
                .mockResolvedValueOnce(3); // newRecipesToday

            prismaMock.comment.count.mockResolvedValue(200);
            prismaMock.like.count.mockResolvedValue(500);

            const result = await adminService.getStats();

            expect(result).toEqual({
                totalUsers: 100,
                totalAdmins: 5,
                totalRecipes: 50,
                totalComments: 200,
                totalLikes: 500,
                newUsersToday: 10,
                newRecipesToday: 3,
            });
        });

        it('should return zero counts when no data', async () => {
            prismaMock.user.count.mockResolvedValue(0);
            prismaMock.post.count.mockResolvedValue(0);
            prismaMock.comment.count.mockResolvedValue(0);
            prismaMock.like.count.mockResolvedValue(0);

            const result = await adminService.getStats();

            expect(result.totalUsers).toBe(0);
            expect(result.totalRecipes).toBe(0);
            expect(result.totalComments).toBe(0);
            expect(result.totalLikes).toBe(0);
        });

        it('should query today stats with correct date filter', async () => {
            prismaMock.user.count.mockResolvedValue(0);
            prismaMock.post.count.mockResolvedValue(0);
            prismaMock.comment.count.mockResolvedValue(0);
            prismaMock.like.count.mockResolvedValue(0);

            await adminService.getStats();

            // Check that at least one call to user.count includes a date filter
            const userCountCalls = prismaMock.user.count.mock.calls;
            const hasDateFilter = userCountCalls.some(
                (call) =>
                    call[0] &&
                    call[0].where &&
                    call[0].where.createdAt &&
                    call[0].where.createdAt.gte
            );
            expect(hasDateFilter).toBe(true);
        });
    });
});
