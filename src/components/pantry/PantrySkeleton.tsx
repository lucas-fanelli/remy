'use client';

import { Box, Grid, Skeleton } from '@mui/material';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/layout/PageFrame';

/**
 * The pantry before it arrives, sized like the page it becomes: the heading, the search bar
 * and two category cards.
 *
 * Shared by the route's loading.tsx, which shows the moment the pantry is opened, and by the
 * page while its first read is on its way, so the one hands over to the other without
 * anything moving. Both used to render nothing, leaving a blank page under the header.
 */
export default function PantrySkeleton() {
  const tCommon = useTranslations('common');

  return (
    <PageFrame>
      <Box role="status" aria-label={tCommon('status.loading')}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width={200} sx={{ fontSize: '2.125rem' }} />
        </Box>
        <Skeleton variant="rounded" height={72} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {[0, 1].map((card) => (
            <Grid item xs={12} md={6} key={card}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </PageFrame>
  );
}
