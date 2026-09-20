'use client';
import { Box, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

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
  const cells = [
    { label: 'PREP TIME', minutes: prepTime },
    { label: 'COOK TIME', minutes: cookingTime },
    { label: 'TOTAL TIME', minutes: prepTime + cookingTime },
  ];

  return (
    <Box
      sx={[
        { display: 'flex', flexWrap: 'wrap', gap: compact ? 2 : { xs: 2, sm: 3, md: 4 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {cells.map(({ label, minutes }) => (
        <Box key={label}>
          <Typography variant="caption" color="text.secondary" display="block">
            {label}
          </Typography>
          {/* A value, not a heading: keep it out of the heading outline */}
          <Typography
            component="p"
            variant={compact ? 'subtitle1' : 'h6'}
            sx={{ fontWeight: 600, color: 'text.primary' }}
          >
            {minutes} min
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
