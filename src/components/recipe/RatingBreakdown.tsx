'use client';
import { Star } from '@mui/icons-material';
import { Box, LinearProgress, Typography } from '@mui/material';
import { useFormatter, useTranslations } from 'next-intl';
import React from 'react';
import type { RatingBreakdown as Breakdown } from '@/domain/types/recipe';

/**
 * How the scores are spread, five rows, most stars first.
 *
 * An average of 3 can be everyone shrugging or half the room loving it and half hating
 * it. The mean alone could not tell those apart, and until now the mean was all a reader
 * got. No names here — rating is anonymous, and showing who gave what would quietly turn
 * a private score into a public one.
 */
interface RatingBreakdownProps {
  breakdown: Breakdown;
  total: number;
}

const SCORES = [5, 4, 3, 2, 1] as const;

export default function RatingBreakdown({ breakdown, total }: RatingBreakdownProps) {
  const t = useTranslations('recipe');
  const format = useFormatter();

  if (total <= 0) return null;

  return (
    <Box sx={{ maxWidth: 320, mb: { xs: 2, md: 3 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {t('meta.ratingBreakdown')}
      </Typography>
      {SCORES.map((score) => {
        const count = breakdown[score] ?? 0;
        const share = total > 0 ? (count / total) * 100 : 0;
        return (
          <Box
            key={score}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            // One row, one sentence, so a screen reader does not read out three
            // disconnected numbers.
            aria-label={t('meta.ratingBreakdownRow', { score, count })}
          >
            <Box
              aria-hidden
              sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 28 }}
            >
              <Typography variant="caption" color="text.secondary">
                {score}
              </Typography>
              <Star sx={{ fontSize: 12, color: 'warning.main' }} />
            </Box>
            <LinearProgress
              aria-hidden
              variant="determinate"
              value={share}
              sx={{
                flexGrow: 1,
                height: 6,
                borderRadius: 3,
                // The track colour is the theme's now. This used to set it by hand
                // because MUI's default sat almost exactly on the dark paper colour.
                '& .MuiLinearProgress-bar': { borderRadius: 3 },
              }}
            />
            <Typography
              aria-hidden
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 20, textAlign: 'right' }}
            >
              {format.number(count)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
