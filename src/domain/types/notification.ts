/**
 * Domain types for Notification
 * Following Domain-Driven Design principles
 */

export type NotificationType = 'follow' | 'like' | 'comment' | 'rating';

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
