'use client';

import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/layout/PageFrame';

/**
 * The rows of the notifications page before its first answer: the title is known, the
 * rows are not. It used to render nothing at all, a blank column under the header until the
 * list arrived.
 */
export function NotificationRowsSkeleton() {
  const tCommon = useTranslations('common');

  return (
    <Paper role="status" aria-label={tCommon('status.loading')}>
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

/**
 * The whole notifications page before it arrives — its title as the page prints it with
 * nothing unread, and the rows — for the route's loading.tsx, which used to be null.
 */
export default function NotificationsPageSkeleton() {
  const t = useTranslations('notifications');

  return (
    <PageFrame width="reading">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {t('title')}
        </Typography>
      </Box>
      <NotificationRowsSkeleton />
    </PageFrame>
  );
}
