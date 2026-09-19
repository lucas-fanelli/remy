'use client';
import { Chip, ChipProps } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { getDifficultyColor } from '@/lib/utils/recipe';

export interface DifficultyChipProps {
  difficulty: string;
  size?: ChipProps['size'];
  sx?: SxProps<Theme>;
}

/** 'Easy' / 'Medium' / 'Hard', filled with the difficulty colour */
export default function DifficultyChip({ difficulty, size = 'medium', sx }: DifficultyChipProps) {
  return (
    <Chip
      label={difficulty}
      color={getDifficultyColor(difficulty)}
      size={size}
      sx={[
        {
          textTransform: 'capitalize',
          fontWeight: 600,
          color: 'common.white',
          '& .MuiChip-label': { color: 'common.white' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
