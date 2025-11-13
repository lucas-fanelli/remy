import { PrismaClient, Notification as PrismaNotification } from '@prisma/client';
import { INotificationRepository } from '@/domain/repositories/INotificationRepository';
import {
  Notification,
  NotificationWithSender,
  CreateNotificationDTO,
  UpdateNotificationDTO,
  NotificationQueryOptions,
  NotificationSender,
} from '@/domain/types/notification';

/**
 * Concrete implementation of INotificationRepository using Prisma
 * Follows Single Responsibility Principle - only handles notification data access
 */
export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateNotificationDTO): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        senderId: data.senderId,
        type: data.type,
        postId: data.postId || null,
        commentId: data.commentId || null,
      },
    });

    return this.mapToNotification(notification);
  }

  async findById(id: string): Promise<Notification | null> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
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

    return notification ? this.mapToNotificationWithSender(notification) : null;
  }

  async findMany(options: NotificationQueryOptions): Promise<NotificationWithSender[]> {
    const {
      filters,
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
      includeSender = true,
    } = options;

    const where: any = {};

    if (filters) {
      if (filters.recipientId) where.recipientId = filters.recipientId;
      if (filters.senderId) where.senderId = filters.senderId;
      if (filters.type) where.type = filters.type;
      if (filters.isRead !== undefined) where.isRead = filters.isRead;
      if (filters.postId) where.postId = filters.postId;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { [orderBy]: orderDirection },
      take: limit,
      skip: offset,
      include: includeSender
        ? {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true,
              },
            },
          }
        : undefined,
    });

    return notifications.map((n) => this.mapToNotificationWithSender(n));
  }

  async findByRecipientId(
    recipientId: string,
    limit = 50,
    offset = 0,
    includeSender = true
  ): Promise<NotificationWithSender[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: includeSender
        ? {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true,
              },
            },
          }
        : undefined,
    });

    return notifications.map((n) => this.mapToNotificationWithSender(n));
  }

  async findUnreadByRecipientId(
    recipientId: string,
    limit = 50,
    offset = 0
  ): Promise<NotificationWithSender[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
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

    return notifications.map((n) => this.mapToNotificationWithSender(n));
  }

  async update(id: string, data: UpdateNotificationDTO): Promise<Notification> {
    const notification = await this.prisma.notification.update({
      where: { id },
      data,
    });

    return this.mapToNotification(notification);
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.update(id, { isRead: true });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notification.delete({
      where: { id },
    });
  }

  async deleteMany(filters: {
    recipientId?: string;
    senderId?: string;
    type?: string;
    postId?: string;
  }): Promise<number> {
    const where: any = {};

    if (filters.recipientId) where.recipientId = filters.recipientId;
    if (filters.senderId) where.senderId = filters.senderId;
    if (filters.type) where.type = filters.type;
    if (filters.postId) where.postId = filters.postId;

    const result = await this.prisma.notification.deleteMany({ where });
    return result.count;
  }

  async exists(filters: {
    recipientId: string;
    senderId: string;
    type: string;
    postId?: string;
  }): Promise<boolean> {
    const where: any = {
      recipientId: filters.recipientId,
      senderId: filters.senderId,
      type: filters.type,
    };

    if (filters.postId) {
      where.postId = filters.postId;
    }

    const notification = await this.prisma.notification.findFirst({ where });
    return notification !== null;
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientId,
        isRead: false,
      },
    });
  }

  async getCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId },
    });
  }

  async deleteOldReadNotifications(olderThan: Date): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: olderThan,
        },
      },
    });

    return result.count;
  }

  /**
   * Maps Prisma Notification to domain Notification
   */
  private mapToNotification(notification: PrismaNotification): Notification {
    return {
      id: notification.id,
      recipientId: notification.recipientId,
      senderId: notification.senderId,
      type: notification.type as any,
      postId: notification.postId,
      commentId: notification.commentId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Maps Prisma Notification with sender to domain NotificationWithSender
   */
  private mapToNotificationWithSender(notification: any): NotificationWithSender {
    const mapped = this.mapToNotification(notification);

    return {
      ...mapped,
      sender: notification.sender
        ? {
            id: notification.sender.id,
            username: notification.sender.username,
            fullName: notification.sender.fullName,
            avatar: notification.sender.avatar,
          }
        : {
            id: notification.senderId,
            username: 'Unknown',
            fullName: null,
            avatar: null,
          },
    };
  }
}
