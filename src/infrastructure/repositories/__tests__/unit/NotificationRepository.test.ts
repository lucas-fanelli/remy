import { PrismaClient } from '@prisma/client';
import { CreateNotificationDTO } from '@/domain/types/notification';
import { NotificationRepository } from '../../NotificationRepository';

// Mock Prisma Client
const mockPrisma = {
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('NotificationRepository', () => {
  let repository: NotificationRepository;

  beforeEach(() => {
    repository = new NotificationRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      const dto: CreateNotificationDTO = {
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
      };

      const mockNotification = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
      };

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.create(dto);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          recipientId: 'user1',
          senderId: 'user2',
          type: 'follow',
          postId: null,
          commentId: null,
        },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should create a like notification with postId', async () => {
      const dto: CreateNotificationDTO = {
        recipientId: 'user1',
        senderId: 'user2',
        type: 'like',
        postId: 'post1',
      };

      const mockNotification = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'like',
        postId: 'post1',
        commentId: null,
        isRead: false,
        createdAt: new Date(),
      };

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.create(dto);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          recipientId: 'user1',
          senderId: 'user2',
          type: 'like',
          postId: 'post1',
          commentId: null,
        },
      });
      expect(result.postId).toBe('post1');
    });
  });

  describe('findById', () => {
    it('should find notification by id with sender', async () => {
      const mockNotification = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
        sender: {
          id: 'user2',
          username: 'sender',
          fullName: 'Sender Name',
          avatar: 'avatar.jpg',
        },
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.findById('notif1');

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif1' },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      });
      expect(result).toBeTruthy();
      expect(result?.sender).toBeDefined();
    });

    it('should return null if notification not found', async () => {
      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByRecipientId', () => {
    it('should find notifications for a user with default pagination', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          recipientId: 'user1',
          senderId: 'user2',
          type: 'follow',
          postId: null,
          commentId: null,
          isRead: false,
          createdAt: new Date(),
          sender: {
            id: 'user2',
            username: 'user2',
            fullName: 'User Two',
            avatar: null,
          },
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await repository.findByRecipientId('user1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].sender).toBeDefined();
    });

    it('should support custom pagination', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findByRecipientId('user1', 10, 20);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should support includeSender=false', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findByRecipientId('user1', 50, 0, false);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        })
      );
    });
  });

  describe('findUnreadByRecipientId', () => {
    it('should find only unread notifications', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findUnreadByRecipientId('user1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: 'user1',
            isRead: false,
          },
        })
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      const count = await repository.markAllAsRead('user1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      expect(count).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark specific notification as read', async () => {
      const mockNotification = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: true,
        createdAt: new Date(),
      };

      (mockPrisma.notification.update as jest.Mock).mockResolvedValue(mockNotification);

      const result = await repository.markAsRead('notif1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif1' },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a notification by id - line 177', async () => {
      (mockPrisma.notification.delete as jest.Mock).mockResolvedValue(undefined);

      await repository.delete('notif1');

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notif1' },
      });
    });
  });

  describe('deleteMany', () => {
    it('should delete notifications matching filters', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

      const count = await repository.deleteMany({
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
      });

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          senderId: 'user2',
          type: 'follow',
        },
      });
      expect(count).toBe(3);
    });

    it('should delete notifications with postId filter - line 193', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const count = await repository.deleteMany({
        recipientId: 'user1',
        postId: 'post123',
      });

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          postId: 'post123',
        },
      });
      expect(count).toBe(2);
    });
  });

  describe('mapToNotificationWithSender fallback - line 271', () => {
    it('should use fallback sender when sender is null', async () => {
      const mockNotificationWithoutSender = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
        sender: null, // No sender data
      };

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([
        mockNotificationWithoutSender,
      ]);

      const result = await repository.findByRecipientId('user1');

      expect(result).toHaveLength(1);
      expect(result[0].sender).toEqual({
        id: 'user2',
        username: 'Unknown',
        fullName: null,
        avatar: null,
      });
    });
  });

  describe('exists', () => {
    it('should return true if notification exists', async () => {
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'notif1' });

      const result = await repository.exists({
        recipientId: 'user1',
        senderId: 'user2',
        type: 'like',
        postId: 'post1',
      });

      expect(result).toBe(true);
    });

    it('should return false if notification does not exist', async () => {
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.exists({
        recipientId: 'user1',
        senderId: 'user2',
        type: 'like',
      });

      expect(result).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(7);

      const count = await repository.getUnreadCount('user1');

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          isRead: false,
        },
      });
      expect(count).toBe(7);
    });
  });

  describe('getCount', () => {
    it('should return total count of notifications', async () => {
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(15);

      const count = await repository.getCount('user1');

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'user1' },
      });
      expect(count).toBe(15);
    });
  });

  describe('deleteOldReadNotifications', () => {
    it('should delete old read notifications', async () => {
      const cutoffDate = new Date('2024-01-01');
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      const count = await repository.deleteOldReadNotifications(cutoffDate);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          isRead: true,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      expect(count).toBe(10);
    });
  });

  describe('findMany with filters', () => {
    it('should apply all filters correctly', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findMany({
        filters: {
          recipientId: 'user1',
          senderId: 'user2',
          type: 'like',
          isRead: false,
          postId: 'post1',
        },
        limit: 20,
        offset: 10,
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          senderId: 'user2',
          type: 'like',
          isRead: false,
          postId: 'post1',
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        skip: 10,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      });
    });

    it('should support includeSender=false in findMany', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findMany({
        filters: { recipientId: 'user1' },
        includeSender: false,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        })
      );
    });

    it('should use default values when options are not provided', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findMany({});

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      });
    });
  });
});
