'use client';
import { Box, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useTranslations } from 'next-intl';

export interface RecipeTimeStripProps {
  prepTime: number;
  cookingTime: number;
  /** Smaller values and gaps for the form's compact preview */
  compact?: boolean;
  sx?: SxProps<Theme>;
}

/** PREP TIME / COOK TIME / TOTAL TIME, in minutes */
export default function RecipeTimeStrip({
  prepTime,
  cookingTime,
  compact = false,
  sx,
}: RecipeTimeStripProps) {
  const t = useTranslations('recipe');
  // 'min' is the same word in both languages, so the symbol lives in the shared catalogue
  const tCommon = useTranslations('common');

  const cells = [
    { id: 'prep', label: t('times.prep'), minutes: prepTime },
    { id: 'cook', label: t('times.cook'), minutes: cookingTime },
    { id: 'total', label: t('times.total'), minutes: prepTime + cookingTime },
  ];

  return (
    <Box
      sx={[
        { display: 'flex', flexWrap: 'wrap', gap: compact ? 2 : { xs: 2, sm: 3, md: 4 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {cells.map(({ id, label, minutes }) => (
        <Box key={id}>
          <Typography variant="caption" color="text.secondary" display="block">
            {label}
          </Typography>
          {/* A value, not a heading: keep it out of the heading outline */}
          <Typography
            component="p"
            variant={compact ? 'subtitle1' : 'h6'}
            sx={{ fontWeight: 600, color: 'text.primary' }}
          >
            {tCommon('time.minutesShort', { count: minutes })}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
