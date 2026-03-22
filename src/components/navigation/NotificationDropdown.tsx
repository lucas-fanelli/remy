'use client';

import { FavoriteBorder, PersonAdd, ChatBubbleOutline, Star } from '@mui/icons-material';
import {
  Box,
  Menu,
  Typography,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Divider,
  List,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import React from 'react';

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

interface NotificationDropdownProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => void;
  markingAsRead: boolean;
  mounted: boolean;
  onNotificationClick: (notification: Notification) => void;
}

function getNotificationIcon(type: string) {
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
}

function getNotificationText(notification: Notification) {
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
}

export default function NotificationDropdown({
  anchorEl,
  onClose,
  notifications,
  unreadCount,
  markAllAsRead,
  markingAsRead,
  mounted,
  onNotificationClick,
}: NotificationDropdownProps) {
  const router = useRouter();

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      slotProps={{
        paper: {
          sx: {
            mt: 1.5,
            maxHeight: { xs: '70vh', sm: 500, md: 400 },
            width: { xs: 'calc(100vw - 32px)', sm: 400, md: 360 },
            maxWidth: { xs: 'calc(100vw - 32px)', sm: 400 },
            overflow: 'auto',
          },
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Notifications
        </Typography>
        {unreadCount > 0 && (
          <Button
            size="small"
            onClick={markAllAsRead}
            disabled={markingAsRead}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {markingAsRead ? 'Marking...' : 'Mark all read'}
          </Button>
        )}
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No notifications yet
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            When someone follows you or interacts with your recipes, you&apos;ll see it here
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {notifications.slice(0, 10).map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItemButton
                onClick={() => onNotificationClick(notification)}
                sx={{
                  bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                  transition: 'background-color 0.2s',
                  alignItems: 'flex-start',
                  py: 1.5,
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={notification.sender.avatar || undefined}
                    alt={notification.sender.username}
                    sx={{ width: 40, height: 40 }}
                  >
                    {notification.sender.username.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getNotificationIcon(notification.type)}
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {getNotificationText(notification)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    mounted ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </Typography>
                    )
                  }
                />
              </ListItemButton>
              {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      )}

      {notifications.length > 10 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 1, textAlign: 'center' }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              onClose();
              router.push('/notifications');
            }}
            sx={{ textTransform: 'none' }}
          >
            View all notifications
          </Button>
        </Box>
      )}
    </Menu>
  );
}
