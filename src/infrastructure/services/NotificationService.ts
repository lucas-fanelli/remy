import { INotificationRepository } from '@/domain/repositories/INotificationRepository';
import { INotificationService } from '@/domain/services/INotificationService';
import { NotificationResponse, NotificationWithSender } from '@/domain/types/notification';

/**
 * Notification Service Implementation
 * Handles business logic for notifications
 * Follows Single Responsibility and Dependency Inversion Principles
 */
export class NotificationService implements INotificationService {
  constructor(private readonly notificationRepository: INotificationRepository) {}

  async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<NotificationResponse> {
    const notifications = await this.notificationRepository.findByRecipientId(
      userId,
      limit,
      offset,
      true
    );

    const unreadCount = await this.notificationRepository.getUnreadCount(userId);

    return {
      notifications,
      unreadCount,
      total: await this.notificationRepository.getCount(userId),
    };
  }

  async getUnreadNotifications(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<NotificationWithSender[]> {
    return this.notificationRepository.findUnreadByRecipientId(userId, limit, offset);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.markAsRead(notificationId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(userId);
  }

  async createFollowNotification(followerId: string, followingId: string): Promise<void> {
    // Business rule: Don't create notification if user follows themselves
    if (followerId === followingId) {
      return;
    }

    await this.notificationRepository.create({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow',
    });
  }

  async createFollowRequestNotification(requesterId: string, ownerId: string): Promise<void> {
    // Business rule: nobody is notified of their own action (src/lib/follows already refuses
    // a request to yourself; the service holds the rule on its own, as for every other type)
    if (requesterId === ownerId) {
      return;
    }

    await this.notificationRepository.create({
      recipientId: ownerId,
      senderId: requesterId,
      type: 'follow_request',
    });
  }

  async deleteFollowRequestNotification(requesterId: string, ownerId: string): Promise<void> {
    await this.notificationRepository.deleteMany({
      recipientId: ownerId,
      senderId: requesterId,
      type: 'follow_request',
    });
  }

  async createFollowAcceptedNotification(ownerId: string, requesterId: string): Promise<void> {
    if (ownerId === requesterId) {
      return;
    }

    // The unique index on (recipient, sender, type, post, comment) cannot stop a second one:
    // post and comment are NULL here, and PostgreSQL counts NULLs as distinct. Accept,
    // unfollow, ask again and be accepted again would stack two "aceptó tu solicitud" rows,
    // so the older one goes first.
    await this.notificationRepository.deleteMany({
      recipientId: requesterId,
      senderId: ownerId,
      type: 'follow_accepted',
    });
    await this.notificationRepository.create({
      recipientId: requesterId,
      senderId: ownerId,
      type: 'follow_accepted',
    });
  }

  async createLikeNotification(
    userId: string,
    postId: string,
    postAuthorId: string
  ): Promise<void> {
    // Business rule: Don't create notification if user likes their own post
    if (userId === postAuthorId) {
      return;
    }

    // Business rule: Don't create duplicate like notifications
    const exists = await this.notificationRepository.exists({
      recipientId: postAuthorId,
      senderId: userId,
      type: 'like',
      postId,
    });

    if (!exists) {
      await this.notificationRepository.create({
        recipientId: postAuthorId,
        senderId: userId,
        type: 'like',
        postId,
      });
    }
  }

  async createCommentNotification(
    userId: string,
    postId: string,
    postAuthorId: string,
    commentId: string
  ): Promise<void> {
    // Business rule: Don't create notification if user comments on their own post
    if (userId === postAuthorId) {
      return;
    }

    await this.notificationRepository.create({
      recipientId: postAuthorId,
      senderId: userId,
      type: 'comment',
      postId,
      commentId,
    });
  }

  async createRatingNotification(
    userId: string,
    postId: string,
    postAuthorId: string
  ): Promise<void> {
    // Business rule: Don't create notification if user rates their own post
    if (userId === postAuthorId) {
      return;
    }

    // Business rule: Don't create duplicate rating notifications
    const exists = await this.notificationRepository.exists({
      recipientId: postAuthorId,
      senderId: userId,
      type: 'rating',
      postId,
    });

    if (!exists) {
      await this.notificationRepository.create({
        recipientId: postAuthorId,
        senderId: userId,
        type: 'rating',
        postId,
      });
    }
  }

  async deleteFollowNotification(followerId: string, followingId: string): Promise<void> {
    await this.notificationRepository.deleteMany({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow',
    });
  }

  async deleteLikeNotification(
    userId: string,
    postId: string,
    postAuthorId: string
  ): Promise<void> {
    await this.notificationRepository.deleteMany({
      recipientId: postAuthorId,
      senderId: userId,
      type: 'like',
      postId,
    });
  }

  async cleanupOldNotifications(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.notificationRepository.deleteOldReadNotifications(cutoffDate);
  }
}
