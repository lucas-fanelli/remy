import { NotificationResponse, NotificationWithSender } from '@/domain/types/notification';

/**
 * Notification Service Interface
 * Defines business logic operations for notifications
 * Follows Interface Segregation Principle (ISP)
 */
export interface INotificationService {
  /**
   * Get all notifications for a user with pagination
   */
  getUserNotifications(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<NotificationResponse>;

  /**
   * Get only unread notifications for a user
   */
  getUnreadNotifications(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<NotificationWithSender[]>;

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string): Promise<void>;

  /**
   * Mark a specific notification as read
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Get unread notification count for a user
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Create a follow notification
   */
  createFollowNotification(followerId: string, followingId: string): Promise<void>;

  /**
   * Tell a private account's owner that someone asked to follow them ('follow_request').
   */
  createFollowRequestNotification(requesterId: string, ownerId: string): Promise<void>;

  /**
   * Take a follow request's notification back once there is nothing left to answer: the
   * request was cancelled, declined or accepted.
   */
  deleteFollowRequestNotification(requesterId: string, ownerId: string): Promise<void>;

  /**
   * Tell the one who asked that the owner accepted ('follow_accepted'), replacing any
   * earlier one for the same pair.
   */
  createFollowAcceptedNotification(ownerId: string, requesterId: string): Promise<void>;

  /**
   * Create a like notification
   */
  createLikeNotification(userId: string, postId: string, postAuthorId: string): Promise<void>;

  /**
   * Create a comment notification
   */
  createCommentNotification(
    userId: string,
    postId: string,
    postAuthorId: string,
    commentId: string
  ): Promise<void>;

  /**
   * Create a rating notification
   */
  createRatingNotification(userId: string, postId: string, postAuthorId: string): Promise<void>;

  /**
   * Delete follow notification when unfollowed
   */
  deleteFollowNotification(followerId: string, followingId: string): Promise<void>;

  /**
   * Delete like notification when unliked
   */
  deleteLikeNotification(userId: string, postId: string, postAuthorId: string): Promise<void>;

  /**
   * Clean up old read notifications (for maintenance)
   */
  cleanupOldNotifications(daysOld: number): Promise<number>;
}
