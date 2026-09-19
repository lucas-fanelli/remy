'use client';
import { Chip, ChipProps } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useTranslations } from 'next-intl';
import { getDifficultyColor } from '@/lib/utils/recipe';

export interface DifficultyChipProps {
  /** The value as it is STORED ('easy' / 'medium' / 'hard'); only the label is translated */
  difficulty: string;
  size?: ChipProps['size'];
  sx?: SxProps<Theme>;
}

/** 'Easy' / 'Medium' / 'Hard', filled with the difficulty colour */
export default function DifficultyChip({ difficulty, size = 'medium', sx }: DifficultyChipProps) {
  const t = useTranslations('recipe');

  return (
    <Chip
      // A row written before the list was closed can hold anything: the message echoes an
      // unrecognised value rather than printing a missing-key path
      label={t('meta.difficulty', { level: difficulty })}
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
