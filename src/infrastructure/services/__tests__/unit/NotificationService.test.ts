import { INotificationRepository } from '@/domain/repositories/INotificationRepository';
import {
  Notification,
  NotificationWithSender,
  NotificationResponse,
} from '@/domain/types/notification';
import { NotificationService } from '../../NotificationService';

// Mock repository
const mockRepository: jest.Mocked<INotificationRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  findByRecipientId: jest.fn(),
  findUnreadByRecipientId: jest.fn(),
  update: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  exists: jest.fn(),
  getUnreadCount: jest.fn(),
  getCount: jest.fn(),
  deleteOldReadNotifications: jest.fn(),
};

describe('NotificationService (Refactored)', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService(mockRepository);
    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should return notifications with unread count and total', async () => {
      const mockNotifications: NotificationWithSender[] = [
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

      mockRepository.findByRecipientId.mockResolvedValue(mockNotifications);
      mockRepository.getUnreadCount.mockResolvedValue(1);
      mockRepository.getCount.mockResolvedValue(5);

      const result = await service.getUserNotifications('user1', 50, 0);

      expect(mockRepository.findByRecipientId).toHaveBeenCalledWith('user1', 50, 0, true);
      expect(mockRepository.getUnreadCount).toHaveBeenCalledWith('user1');
      expect(mockRepository.getCount).toHaveBeenCalledWith('user1');
      expect(result).toEqual({
        notifications: mockNotifications,
        unreadCount: 1,
        total: 5,
      });
    });

    it('should use default pagination values', async () => {
      mockRepository.findByRecipientId.mockResolvedValue([]);
      mockRepository.getUnreadCount.mockResolvedValue(0);
      mockRepository.getCount.mockResolvedValue(0);

      await service.getUserNotifications('user1');

      expect(mockRepository.findByRecipientId).toHaveBeenCalledWith('user1', 50, 0, true);
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return only unread notifications', async () => {
      const mockNotifications: NotificationWithSender[] = [];
      mockRepository.findUnreadByRecipientId.mockResolvedValue(mockNotifications);

      const result = await service.getUnreadNotifications('user1', 20, 0);

      expect(mockRepository.findUnreadByRecipientId).toHaveBeenCalledWith('user1', 20, 0);
      expect(result).toEqual(mockNotifications);
    });

    it('should use default pagination values - lines 36-37', async () => {
      mockRepository.findUnreadByRecipientId.mockResolvedValue([]);

      await service.getUnreadNotifications('user1');

      expect(mockRepository.findUnreadByRecipientId).toHaveBeenCalledWith('user1', 50, 0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockRepository.markAllAsRead.mockResolvedValue(5);

      await service.markAllAsRead('user1');

      expect(mockRepository.markAllAsRead).toHaveBeenCalledWith('user1');
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      const mockNotification: Notification = {
        id: 'notif1',
        recipientId: 'user1',
        senderId: 'user2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: true,
        createdAt: new Date(),
      };

      mockRepository.markAsRead.mockResolvedValue(mockNotification);

      await service.markAsRead('notif1');

      expect(mockRepository.markAsRead).toHaveBeenCalledWith('notif1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockRepository.getUnreadCount.mockResolvedValue(3);

      const count = await service.getUnreadCount('user1');

      expect(mockRepository.getUnreadCount).toHaveBeenCalledWith('user1');
      expect(count).toBe(3);
    });
  });

  describe('createFollowNotification', () => {
    it('should create a follow notification', async () => {
      mockRepository.create.mockResolvedValue({} as Notification);

      await service.createFollowNotification('user1', 'user2');

      expect(mockRepository.create).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'follow',
      });
    });

    it('should not create notification if user follows themselves', async () => {
      await service.createFollowNotification('user1', 'user1');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createLikeNotification', () => {
    it('should create a like notification when it does not exist', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue({} as Notification);

      await service.createLikeNotification('user1', 'post1', 'user2');

      expect(mockRepository.exists).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'like',
        postId: 'post1',
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'like',
        postId: 'post1',
      });
    });

    it('should not create notification if user likes their own post', async () => {
      await service.createLikeNotification('user1', 'post1', 'user1');

      expect(mockRepository.exists).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should not create duplicate notification', async () => {
      mockRepository.exists.mockResolvedValue(true);

      await service.createLikeNotification('user1', 'post1', 'user2');

      expect(mockRepository.exists).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createCommentNotification', () => {
    it('should create a comment notification', async () => {
      mockRepository.create.mockResolvedValue({} as Notification);

      await service.createCommentNotification('user1', 'post1', 'user2', 'comment1');

      expect(mockRepository.create).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'comment',
        postId: 'post1',
        commentId: 'comment1',
      });
    });

    it('should not create notification if user comments on their own post', async () => {
      await service.createCommentNotification('user1', 'post1', 'user1', 'comment1');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createRatingNotification', () => {
    it('should create a rating notification when it does not exist', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue({} as Notification);

      await service.createRatingNotification('user1', 'post1', 'user2');

      expect(mockRepository.exists).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'rating',
        postId: 'post1',
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'rating',
        postId: 'post1',
      });
    });

    it('should not create notification if user rates their own post', async () => {
      await service.createRatingNotification('user1', 'post1', 'user1');

      expect(mockRepository.exists).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should not create duplicate notification', async () => {
      mockRepository.exists.mockResolvedValue(true);

      await service.createRatingNotification('user1', 'post1', 'user2');

      expect(mockRepository.exists).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteFollowNotification', () => {
    it('should delete a follow notification', async () => {
      mockRepository.deleteMany.mockResolvedValue(1);

      await service.deleteFollowNotification('user1', 'user2');

      expect(mockRepository.deleteMany).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'follow',
      });
    });
  });

  describe('deleteLikeNotification', () => {
    it('should delete a like notification', async () => {
      mockRepository.deleteMany.mockResolvedValue(1);

      await service.deleteLikeNotification('user1', 'post1', 'user2');

      expect(mockRepository.deleteMany).toHaveBeenCalledWith({
        recipientId: 'user2',
        senderId: 'user1',
        type: 'like',
        postId: 'post1',
      });
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old read notifications', async () => {
      const daysOld = 30;
      mockRepository.deleteOldReadNotifications.mockResolvedValue(10);

      const count = await service.cleanupOldNotifications(daysOld);

      const calledWith = (mockRepository.deleteOldReadNotifications as jest.Mock).mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(Date);
      expect(count).toBe(10);
    });

    it('should calculate correct cutoff date', async () => {
      const daysOld = 7;
      mockRepository.deleteOldReadNotifications.mockResolvedValue(5);

      await service.cleanupOldNotifications(daysOld);

      const calledDate = (mockRepository.deleteOldReadNotifications as jest.Mock).mock
        .calls[0][0] as Date;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - daysOld);

      // Compare dates with a small tolerance (1 second)
      expect(Math.abs(calledDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });
  });
});
