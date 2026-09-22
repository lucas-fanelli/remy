'use client';

import NotificationsPageSkeleton from '@/components/notifications/NotificationsSkeleton';

/**
 * What shows the moment the notifications are opened, while the page is on its way — the
 * page as it looks while its list loads. It used to be null, which blanked the main area.
 */
export default function Loading() {
  return <NotificationsPageSkeleton />;
}
