'use client';

import { Box, Skeleton } from '@mui/material';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/layout/PageFrame';

/**
 * A recipe before it arrives, laid out like the page it becomes: the cover at the height the
 * page gives it, the title, the rating line, the meta chips and the two long sections.
 *
 * Shared by the route's loading.tsx — what shows the moment a card is tapped, while the
 * page itself is still on its way — and by the page while its data loads, so the one hands
 * over to the other without anything moving. Both used to render nothing: measured in
 * production, opening a recipe left the main area blank for ~690 ms.
 */
export default function RecipeSkeleton() {
  const tCommon = useTranslations('common');

  return (
    <PageFrame>
      <Box role="status" aria-label={tCommon('status.loading')}>
        <Skeleton
          variant="rectangular"
          sx={{ height: { xs: 300, sm: 400, md: 500 }, borderRadius: 2 }}
        />
        <Box sx={{ mt: { xs: 2, md: 3 } }}>
          <Skeleton
            variant="text"
            width="70%"
            sx={{ fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' } }}
          />
          <Skeleton variant="text" width={180} sx={{ mb: { xs: 1.5, md: 2 } }} />
          <Box sx={{ display: 'flex', gap: 1, mb: { xs: 2, md: 3 } }}>
            {[96, 110, 84].map((width) => (
              <Skeleton
                key={width}
                variant="rounded"
                width={width}
                height={32}
                sx={{ borderRadius: 4 }}
              />
            ))}
          </Box>
          <Skeleton variant="rounded" height={240} sx={{ mb: { xs: 2, md: 3 } }} />
          <Skeleton variant="rounded" height={320} />
        </Box>
      </Box>
    </PageFrame>
  );
}
