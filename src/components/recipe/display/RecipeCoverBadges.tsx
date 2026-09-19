'use client';
import { AccessTime } from '@mui/icons-material';
import { Chip } from '@mui/material';
import DifficultyChip from './DifficultyChip';

export interface RecipeCoverBadgesProps {
  difficulty: string;
  /** Prep + cook, in minutes. The pill is left out while it is 0 (no time typed yet) */
  totalTime: number;
}

// Literal colours on purpose: the pill sits on a photo, so it must look the same in both
// themes (same values as the feed's RecipeCard)
const ON_PHOTO = '#fff';
const PHOTO_SCRIM = 'rgba(0,0,0,0.7)';

const pillSx = { fontWeight: 600, height: 28, borderRadius: 14 } as const;

/**
 * The badges the feed paints over a cover: difficulty top-right, '{total} min' bottom-left.
 * Both are absolutely positioned - render them inside a `position: 'relative'` box that
 * holds the 4:3 photo (ImageUpload's `overlay` slot is one).
 */
export default function RecipeCoverBadges({ difficulty, totalTime }: RecipeCoverBadgesProps) {
  return (
    <>
      <DifficultyChip
        difficulty={difficulty}
        size="small"
        sx={{
          ...pillSx,
          position: 'absolute',
          top: 12,
          right: 12,
          '& .MuiChip-label': { px: 1.5, color: 'common.white' },
        }}
      />
      {totalTime > 0 && (
        <Chip
          icon={<AccessTime />}
          label={`${totalTime} min`}
          size="small"
          sx={{
            ...pillSx,
            fontWeight: 500,
            position: 'absolute',
            bottom: 12,
            left: 12,
            bgcolor: PHOTO_SCRIM,
            color: ON_PHOTO,
            '& .MuiChip-icon': { color: ON_PHOTO, fontSize: 16 },
            '& .MuiChip-label': { pr: 1.5 },
          }}
        />
      )}
    </>
  );
}
