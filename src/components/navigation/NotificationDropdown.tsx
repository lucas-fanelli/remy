'use client';

import {
  FavoriteBorder,
  PersonAdd,
  PersonAddAlt1,
  HowToReg,
  ChatBubbleOutline,
  Star,
  ChevronRight,
} from '@mui/icons-material';
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
import { useFormatter, useTranslations } from 'next-intl';
import React from 'react';
import { FOLLOW_REQUESTS_PATH } from '@/hooks/useFollowRequests';
import { useDateFnsLocale } from '@/i18n/dates';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import type { NotificationType } from '@/domain/types/notification';

interface Notification {
  id: string;
  type: NotificationType;
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
  /**
   * Follow requests waiting on an answer, from the requests table. It drives the pinned
   * row, and it is deliberately not derived from `notifications`: those are only the first
   * rows, can be read or deleted, and none of that answers a request.
   */
  pendingRequestsCount: number;
  markAllAsRead: () => void;
  markingAsRead: boolean;
  mounted: boolean;
  onNotificationClick: (notification: Notification) => void;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'follow':
      return <PersonAdd color="primary" />;
    // The same person-and-plus family as a follow, told apart at a glance: someone asking
    // (a request waiting on you), and someone who said yes to you.
    case 'follow_request':
      return <PersonAddAlt1 color="primary" />;
    case 'follow_accepted':
      return <HowToReg color="success" />;
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

/**
 * "Solicitudes de seguimiento · N solicitudes pendientes", pinned above the notifications
 * whenever anyone is waiting on an answer. Shared by this dropdown and /notifications.
 *
 * Pinned rather than found among the rows because a "quiere seguirte" can be read, deleted
 * or pushed past the first ten, and the request would still be there. And a row of its own
 * rather than buttons on each "quiere seguirte": every notification row is a button, and an
 * "Aceptar" inside one would be a button nested in a button, its tap also opening the row.
 */
export function PendingRequestsRow({ count, onClick }: { count: number; onClick: () => void }) {
  const t = useTranslations('notifications');
  return (
    <ListItemButton onClick={onClick} sx={{ py: 1.5 }}>
      <ListItemAvatar>
        <Avatar
          sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          <PersonAddAlt1 fontSize="small" />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={t('requests.title')}
        secondary={t('requests.pending', { count })}
        slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }}
      />
      <ChevronRight color="action" />
    </ListItemButton>
  );
}

export default function NotificationDropdown({
  anchorEl,
  onClose,
  notifications,
  unreadCount,
  pendingRequestsCount,
  markAllAsRead,
  markingAsRead,
  mounted,
  onNotificationClick,
}: NotificationDropdownProps) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const dateLocale = useDateFnsLocale();
  const router = useRouter();

  // One ICU `select`, not four concatenations: the sender's name sits where each language
  // wants it ('A Ana le gustó tu receta'), and a type the API adds later falls through to
  // the generic sentence instead of rendering a missing key.
  const notificationText = (notification: Notification) =>
    t('text', {
      type: notification.type,
      name: notification.sender.fullName || notification.sender.username,
    });

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
            // 100% of the Popover's fixed root, i.e. the viewport WITHOUT the scrollbar.
            // 100vw includes it, so this used to be 8px too wide and was only ever hidden
            // by the global overflow clip that caused the layout shift.
            width: { xs: 'calc(100% - 32px)', sm: 400, md: 360 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 400 },
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
          {t('title')}
        </Typography>
        {unreadCount > 0 && (
          <Button
            size="small"
            onClick={markAllAsRead}
            disabled={markingAsRead}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {markingAsRead ? t('marking') : t('markAllShort')}
          </Button>
        )}
      </Box>

      {pendingRequestsCount > 0 && (
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <PendingRequestsRow
            count={pendingRequestsCount}
            onClick={() => {
              onClose();
              router.push(FOLLOW_REQUESTS_PATH);
            }}
          />
        </Box>
      )}

      {notifications.length === 0 ? (
        // Pending requests are something to act on, so "todavía no tenés notificaciones"
        // under the row that lists them would contradict it.
        pendingRequestsCount > 0 ? null : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('empty.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('empty.description')}
            </Typography>
          </Box>
        )
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
                    src={cloudinaryImage(notification.sender.avatar, 'avatar') || undefined}
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
                        {notificationText(notification)}
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
                          locale: dateLocale,
                        })}
                      </Typography>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {format.dateTime(new Date(notification.createdAt), {
                          dateStyle: 'short',
                        })}
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
            {t('viewAll')}
          </Button>
        </Box>
      )}
    </Menu>
  );
}
