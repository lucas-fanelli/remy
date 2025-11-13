import {
  Notification,
  NotificationWithSender,
  CreateNotificationDTO,
  UpdateNotificationDTO,
  NotificationQueryOptions,
} from '@/domain/types/notification';

/**
 * Notification Repository Interface
 * Follows Repository Pattern and Dependency Inversion Principle (DIP)
 *
 * This interface defines the contract for notification data access,
 * allowing different implementations (Prisma, MongoDB, in-memory, etc.)
 */
export interface INotificationRepository {
  /**
   * Create a new notification
   */
  create(data: CreateNotificationDTO): Promise<Notification>;

  /**
   * Find notification by ID
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Find notifications with optional filters and pagination
   */
  findMany(options: NotificationQueryOptions): Promise<NotificationWithSender[]>;

  /**
   * Find notifications for a specific user
   */
  findByRecipientId(
    recipientId: string,
    limit?: number,
    offset?: number,
    includeSender?: boolean
  ): Promise<NotificationWithSender[]>;

  /**
   * Find unread notifications for a user
   */
  findUnreadByRecipientId(
    recipientId: string,
    limit?: number,
    offset?: number
  ): Promise<NotificationWithSender[]>;

  /**
   * Update a notification
   */
  update(id: string, data: UpdateNotificationDTO): Promise<Notification>;

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(recipientId: string): Promise<number>; // Returns count of updated records

  /**
   * Mark specific notification as read
   */
  markAsRead(id: string): Promise<Notification>;

  /**
   * Delete a notification
   */
  delete(id: string): Promise<void>;

  /**
   * Delete notifications matching criteria (for cleanup when action is undone)
   */
  deleteMany(filters: {
    recipientId?: string;
    senderId?: string;
    type?: string;
    postId?: string;
  }): Promise<number>; // Returns count of deleted records

  /**
   * Check if a notification exists
   */
  exists(filters: {
    recipientId: string;
    senderId: string;
    type: string;
    postId?: string;
  }): Promise<boolean>;

  /**
   * Get count of unread notifications for a user
   */
  getUnreadCount(recipientId: string): Promise<number>;

  /**
   * Get total count of notifications for a user
   */
  getCount(recipientId: string): Promise<number>;

  /**
   * Delete old read notifications (for cleanup)
   */
  deleteOldReadNotifications(olderThan: Date): Promise<number>;
}
