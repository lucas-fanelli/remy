import { queryKeys } from '@/lib/query/keys';
import { afterRequestAccepted } from './useFollowRequests';
import type { NotificationType } from '@/domain/types/notification';
import type { QueryClient } from '@tanstack/react-query';

/** The part of a polled notification that says what changed. */
export interface NotificationNews {
  type: NotificationType;
  sender: { username: string };
  postId?: string | null;
}

/**
 * Something someone else did, heard through the bell: bring the screens it changed up to
 * date.
 *
 * The bell is the only way the app hears about other people, and it used to keep what it
 * heard to itself. Lucas, testing with two accounts in production: the owner accepted his
 * request and his window went on saying "Solicitado" until he reloaded it; the owner's
 * window showed no request until reloaded either. Each type names what it changed:
 *
 * - follow_accepted: the owner's profile unlocks for you, and their recipes join your
 *   lists — what tapping that notification already did, now done when it arrives.
 * - follow_request: your inbox of requests.
 * - follow: your own follower count.
 * - like, comment, rating: that recipe's counts, and your profile, which lists it.
 *
 * `viewer` is who is signed in.
 */
export function applyNotificationsToCache(
  queryClient: QueryClient,
  news: NotificationNews[],
  viewer: string | null | undefined
): void {
  for (const notification of news) {
    switch (notification.type) {
      case 'follow_accepted':
        afterRequestAccepted(queryClient, notification.sender.username, viewer);
        break;
      case 'follow_request':
        void queryClient.invalidateQueries({ queryKey: queryKeys.followRequests() });
        break;
      case 'follow':
        if (viewer) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(viewer) });
        break;
      case 'like':
      case 'comment':
      case 'rating':
        if (notification.postId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(notification.postId) });
        }
        if (viewer) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(viewer) });
        break;
    }
  }
}
