'use client';

import {
  FavoriteBorder,
  PersonAdd,
  PersonAddAlt1,
  HowToReg,
  ChatBubbleOutline,
  Star,
} from '@mui/icons-material';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
  Alert,
  Skeleton,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { PendingRequestsRow } from '@/components/navigation/NotificationDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { FOLLOW_REQUESTS_PATH, afterRequestAccepted } from '@/hooks/useFollowRequests';
import { useDateFnsLocale } from '@/i18n/dates';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
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

const PAGE_SIZE = 20;

/**
 * The page before its first answer, sized like it: the title is known, the rows are not.
 * It used to render nothing at all, a blank column under the header until the list arrived.
 */
function NotificationsSkeleton({ label }: { label: string }) {
  return (
    <Paper role="status" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 2,
            px: 2,
            py: 1.5,
            borderBottom: i < 4 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="25%" />
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const dateLocale = useDateFnsLocale();
  const { user, isLoading } = useAuth();
  const apiErrorMessage = useApiErrorMessage();
  // The shared toast, not another local Snackbar. There are already several of those and
  // this page had none, which is part of why its failures had nowhere to appear.
  const { showError } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  /**
   * Follow requests waiting on an answer, as this page's own GET counted them in the
   * requests table. Not the navigation's copy: this page already makes the request that
   * carries it, and a second source could disagree with the rows it sits above.
   */
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  /** A failed read is not an empty one, and the page has to be able to say which. */
  const [loadFailed, setLoadFailed] = useState(false);

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

        if (!response.ok) {
          // Two different failures, and they need two different answers. A failed FIRST
          // page left the list `[]` and the page rendered "you have no notifications yet"
          // — a server error dressed as good news — so that one replaces the whole list
          // with an error and a retry. A failed "load more" happens while a perfectly good
          // list is on screen; replacing it would throw away what the reader already has,
          // so that one is a toast. A first draft of this handled only the first case and
          // reintroduced the silence for the second.
          if (append) {
            showError(apiErrorMessage(await readBody(response), t('loadFailed')));
          } else {
            setLoadFailed(true);
          }
          return;
        }

        setLoadFailed(false);
        const data = await response.json();
        const fetched = data.notifications || [];
        // Every page answers the count as it is now, so the latest page's is the truest.
        const pending = data.pendingRequestsCount;
        setPendingRequestsCount(
          typeof pending === 'number' && Number.isFinite(pending) && pending > 0 ? pending : 0
        );
        if (append) {
          setNotifications((prev) => [...prev, ...fetched]);
        } else {
          setNotifications(fetched);
        }
        setHasMore(fetched.length === PAGE_SIZE);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        if (append) {
          showError(t('loadFailed'));
        } else {
          setLoadFailed(true);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // All three are stable identities, which matters because the effect below depends on
    // this callback: `showToast` is `useCallback(…, [])`, `showError` depends only on it,
    // and `apiErrorMessage` only on next-intl's `t`, which is memoised per locale. An
    // unstable one here would turn a mount into a refetch loop.
    [user, showError, apiErrorMessage, t]
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

      if (!response.ok) {
        // Was silent: the dots stayed exactly where they were and nothing was said, so
        // the only reading available was that the button did not register the tap.
        showError(apiErrorMessage(await readBody(response), t('markAllFailed')));
        return;
      }

      setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      showError(t('markAllFailed'));
    } finally {
      setMarkingAsRead(false);
    }
  };

  // The same icons as the dropdown (NotificationDropdown.tsx), which says why these two.
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <PersonAdd color="primary" />;
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
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          // The middleware refuses a write without it (CSRF); the dropdown always sent it.
          headers: { 'X-Requested-With': 'fetch' },
        });
      } catch {} // Best effort
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }

    // The same routing as the dropdown's (Navigation.tsx).
    if (notification.type === 'follow_request') {
      router.push(FOLLOW_REQUESTS_PATH);
    } else if (notification.type === 'follow' || notification.type === 'follow_accepted') {
      if (notification.type === 'follow_accepted') {
        afterRequestAccepted(queryClient, notification.sender.username, user?.username);
      }
      router.push(`/profile/${notification.sender.username}`);
    } else if (notification.postId) {
      router.push(`/recipe/${notification.postId}`);
    }
  };

  const header = (unreadCount: number) => (
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
        {t('title')}
      </Typography>
      {unreadCount > 0 && (
        <Button variant="text" onClick={markAllAsRead} disabled={markingAsRead} size="small">
          {markingAsRead ? t('marking') : t('markAll')}
        </Button>
      )}
    </Box>
  );

  // Signed out as well: the redirect above is on its way.
  if (isLoading || !user || loading) {
    return (
      <PageFrame width="reading">
        {header(0)}
        <NotificationsSkeleton label={tCommon('status.loading')} />
      </PageFrame>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <PageFrame width="reading">
      {header(unreadCount)}

      {/* Pinned above everything, as in the dropdown: see PendingRequestsRow for why it is a
          row of its own and not buttons on each "quiere seguirte". */}
      {!loadFailed && pendingRequestsCount > 0 && (
        <Paper sx={{ mb: 2, overflow: 'hidden' }}>
          <PendingRequestsRow
            count={pendingRequestsCount}
            onClick={() => router.push(FOLLOW_REQUESTS_PATH)}
          />
        </Paper>
      )}

      {/* A read that failed is not a read that found nothing. Before this, a 500 rendered
          "you have no notifications yet" — the most reassuring possible way to show an
          error — and the only way out was to reload the page and hope. This branch is the
          FIRST page only; a failed "load more" raises a toast instead, so that a list the
          reader already has is never thrown away to report that there is no more of it. */}
      {loadFailed ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => fetchNotifications()}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('loadFailed')}
        </Alert>
      ) : notifications.length === 0 ? (
        // Not under a pinned row of requests waiting on an answer: "todavía no tenés
        // notificaciones" would contradict it.
        pendingRequestsCount > 0 ? null : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('empty.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('empty.description')}
            </Typography>
          </Paper>
        )
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
    </PageFrame>
  );
}
