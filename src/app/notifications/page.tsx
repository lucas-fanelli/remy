'use client';

import { FavoriteBorder, PersonAdd, ChatBubbleOutline, Star } from '@mui/icons-material';
import {
  Container,
  Box,
  Typography,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFnsLocale } from '@/i18n/dates';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'rating';
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    fullName: string | null;
    avatar: string | null;
  };
  postId?: string | null;
  commentId?: string | null;
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const dateLocale = useDateFnsLocale();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(
    async (currentOffset = 0, append = false) => {
      if (!user) return;

      try {
        if (append) {
          setLoadingMore(true);
        }
        const response = await fetch(
          `/api/notifications?limit=${PAGE_SIZE}&offset=${currentOffset}`
        );

        if (response.ok) {
          const data = await response.json();
          const fetched = data.notifications || [];
          if (append) {
            setNotifications((prev) => [...prev, ...fetched]);
          } else {
            setNotifications(fetched);
          }
          setHasMore(fetched.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user]
  );

  const handleLoadMore = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchNotifications(newOffset, true);
  }, [offset, fetchNotifications]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
      return;
    }

    if (user) {
      fetchNotifications();
    }
  }, [user, isLoading, router, fetchNotifications]);

  const markAllAsRead = async () => {
    if (!user || markingAsRead) return;

    try {
      setMarkingAsRead(true);
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <PersonAdd color="primary" />;
      case 'like':
        return <FavoriteBorder color="error" />;
      case 'comment':
        return <ChatBubbleOutline color="info" />;
      case 'rating':
        return <Star sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  // One ICU `select` rather than four templates: each language decides where the sender's
  // name goes, and an unknown type falls through to the generic sentence.
  const getNotificationText = (notification: Notification) =>
    t('text', {
      type: notification.type,
      name: notification.sender.fullName || notification.sender.username,
    });

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read (best effort) before navigating
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' });
      } catch {} // Best effort
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }

    if (notification.type === 'follow') {
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (loading) {
    return null;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Container maxWidth="md" sx={{ mt: 10, pb: 8 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {t('title')}
        </Typography>
        {unreadCount > 0 && (
          <Button variant="text" onClick={markAllAsRead} disabled={markingAsRead} size="small">
            {markingAsRead ? t('marking') : t('markAll')}
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {t('empty.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('empty.description')}
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <List sx={{ width: '100%' }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                    transition: 'background-color 0.2s',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={cloudinaryImage(notification.sender.avatar, 'avatar') || undefined}
                      alt={notification.sender.username}
                    >
                      {notification.sender.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getNotificationIcon(notification.type)}
                        <Typography variant="body1">{getNotificationText(notification)}</Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && (
                  <Box
                    component="hr"
                    sx={{ border: 'none', borderTop: '1px solid', borderColor: 'divider', m: 0 }}
                  />
                )}
              </React.Fragment>
            ))}
          </List>
          {hasMore && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Button variant="text" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? tCommon('status.loading') : t('loadMore')}
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}
