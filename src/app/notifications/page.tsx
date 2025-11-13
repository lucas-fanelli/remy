'use client';
import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Button,
} from '@mui/material';
import { FavoriteBorder, PersonAdd, ChatBubbleOutline, Star } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

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

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    fetchNotifications();
  }, [user, token, router]);

  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (!token || markingAsRead) return;

    try {
      setMarkingAsRead(true);
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, isRead: true }))
        );
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

  const getNotificationText = (notification: Notification) => {
    const senderName = notification.sender.fullName || notification.sender.username;

    switch (notification.type) {
      case 'follow':
        return `${senderName} started following you`;
      case 'like':
        return `${senderName} liked your recipe`;
      case 'comment':
        return `${senderName} commented on your recipe`;
      case 'rating':
        return `${senderName} rated your recipe`;
      default:
        return 'You have a new notification';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'follow') {
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 10, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Container maxWidth="md" sx={{ mt: 10, pb: 8 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Notifications
        </Typography>
        {unreadCount > 0 && (
          <Button
            variant="text"
            onClick={markAllAsRead}
            disabled={markingAsRead}
            size="small"
          >
            {markingAsRead ? 'Marking...' : 'Mark all as read'}
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No notifications yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            When someone follows you or interacts with your recipes, you'll see it here
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
                      src={notification.sender.avatar || undefined}
                      alt={notification.sender.username}
                    >
                      {notification.sender.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getNotificationIcon(notification.type)}
                        <Typography variant="body1">
                          {getNotificationText(notification)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && <Box component="hr" sx={{ border: 'none', borderTop: '1px solid', borderColor: 'divider', m: 0 }} />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  );
}
