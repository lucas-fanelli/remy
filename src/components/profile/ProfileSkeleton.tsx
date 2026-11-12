'use client';

import { Box, Skeleton } from '@mui/material';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/layout/PageFrame';
import RecipeGridSkeleton from '@/components/recipe/RecipeGridSkeleton';

/**
 * A profile before it arrives, sized like the page it becomes: avatar, name, bio, grid.
 *
 * Shared by the route's loading.tsx — what shows the moment a profile is opened — and by
 * the page while its data loads, so the one hands over to the other without anything
 * moving. The page's own copy of this was right; the route's loading.tsx rendered nothing,
 * which blanked the main area for the trip to the server.
 */
export default function ProfileSkeleton() {
  const tCommon = useTranslations('common');

  return (
    <PageFrame>
      <Box role="status" aria-label={tCommon('status.loading')}>
        <Box sx={{ display: 'flex', gap: 4, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Skeleton
              variant="circular"
              sx={{ width: { xs: 100, sm: 150 }, height: { xs: 100, sm: 150 } }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={180} sx={{ fontSize: '2.125rem', mb: 2 }} />
            <Skeleton variant="text" width={280} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Box>
        <RecipeGridSkeleton />
      </Box>
    </PageFrame>
  );
}
