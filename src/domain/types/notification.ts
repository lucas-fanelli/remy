/**
 * Domain types for Notification
 * Following Domain-Driven Design principles
 */

/**
 * The stored `Notification.type`. The client passes it straight to the ICU select in
 * notifications.text, so each value must be a valid select key: underscores, never hyphens —
 * a hyphen breaks parsing of the whole message, for every type.
 *
 * - follow_request: someone asked to follow a private account; sent to its owner.
 * - follow_accepted: the owner accepted; sent to the one who asked.
 */
export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'like'
  | 'comment'
  | 'rating';

export interface NotificationSender {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  isRead: boolean;
  createdAt: Date;
  sender?: NotificationSender;
}

export interface NotificationWithSender extends Notification {
  sender: NotificationSender;
}

/**
 * Data Transfer Objects (DTOs)
 */

export interface CreateNotificationDTO {
  recipientId: string;
  senderId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
}

export interface UpdateNotificationDTO {
  isRead?: boolean;
}

export interface NotificationFilters {
  recipientId?: string;
  senderId?: string;
  type?: NotificationType;
  isRead?: boolean;
  postId?: string;
}

export interface NotificationQueryOptions {
  filters?: NotificationFilters;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'isRead';
  orderDirection?: 'asc' | 'desc';
  includeSender?: boolean;
}

export interface NotificationResponse {
  notifications: NotificationWithSender[];
  unreadCount: number;
  total?: number;
}
