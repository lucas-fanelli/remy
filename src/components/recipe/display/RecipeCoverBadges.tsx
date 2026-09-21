'use client';
import { AccessTime } from '@mui/icons-material';
import { Chip } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useTokens } from '@/theme/useTokens';
import DifficultyChip from './DifficultyChip';

export interface RecipeCoverBadgesProps {
  /** The value as it is STORED; DifficultyChip translates the label */
  difficulty: string;
  /** Prep + cook, in minutes. The pill is left out while it is 0 (no time typed yet) */
  totalTime: number;
}

const pillSx = { fontWeight: 600, height: 28, borderRadius: 14 } as const;

/**
 * The badges the feed paints over a cover: difficulty top-right, '{total} min' bottom-left.
 * Both are absolutely positioned - render them inside a `position: 'relative'` box that
 * holds the 4:3 photo (ImageUpload's `overlay` slot is one).
 */
export default function RecipeCoverBadges({ difficulty, totalTime }: RecipeCoverBadgesProps) {
  const t = useTranslations('common');
  const tokens = useTokens();

  return (
    <>
      {/* The difficulty pill brings its own filled colour, so it is readable over any
          photo without help; its ink comes from that fill's contrastText, not from here */}
      <DifficultyChip
        difficulty={difficulty}
        size="small"
        sx={{
          ...pillSx,
          position: 'absolute',
          top: 12,
          right: 12,
          '& .MuiChip-label': { px: 1.5 },
        }}
      />
      {totalTime > 0 && (
        <Chip
          icon={<AccessTime />}
          label={t('time.minutesShort', { count: totalTime })}
          size="small"
          sx={{
            ...pillSx,
            fontWeight: 500,
            position: 'absolute',
            bottom: 12,
            left: 12,
            // Light ink on a scrim, the same in both modes: this pill sits on the photo,
            // never on the page behind it
            bgcolor: tokens.surface.overlay,
            color: tokens.text.onOverlay,
            '& .MuiChip-icon': { color: tokens.text.onOverlay, fontSize: 16 },
            '& .MuiChip-label': { pr: 1.5 },
          }}
        />
      )}
    </>
  );
}
