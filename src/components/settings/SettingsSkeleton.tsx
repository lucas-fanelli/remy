'use client';

import { Box, Skeleton } from '@mui/material';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/layout/PageFrame';

/**
 * The settings page before the session is known: its title row and its three panels. Shared
 * by the route's loading.tsx and by the page while it waits for the session; both rendered
 * nothing, which blanked the main area.
 */
export default function SettingsSkeleton() {
  const tCommon = useTranslations('common');

  return (
    <PageFrame width="reading">
      <Box role="status" aria-label={tCommon('status.loading')}>
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Skeleton
            variant="text"
            width={220}
            sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' }, ml: 7 }}
          />
          <Skeleton variant="text" width={260} sx={{ ml: 7 }} />
        </Box>
        {[140, 180, 140].map((height, index) => (
          <Skeleton key={index} variant="rounded" height={height} sx={{ mb: { xs: 2, md: 3 } }} />
        ))}
      </Box>
    </PageFrame>
  );
}
