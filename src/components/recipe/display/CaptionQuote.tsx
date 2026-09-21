'use client';
import { Paper, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useTokens } from '@/theme/useTokens';

export interface CaptionQuoteProps {
  caption: string;
  /** 'elevation' (default) is the published page; the form's preview uses 'outlined' */
  variant?: 'elevation' | 'outlined';
  sx?: SxProps<Theme>;
}

/** The closing note, printed as a quote after the last step */
export default function CaptionQuote({ caption, variant = 'elevation', sx }: CaptionQuoteProps) {
  const tokens = useTokens();

  return (
    <Paper
      variant={variant}
      sx={[
        {
          p: 3,
          // The quote is an inset panel, which `surface.sunken` already answers for both
          // modes — so the mode branch that picked between two greys goes with it
          bgcolor: variant === 'outlined' ? 'action.hover' : tokens.surface.sunken,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography variant="body1" sx={{ fontStyle: 'italic', whiteSpace: 'pre-line' }}>
        &ldquo;{caption}&rdquo;
      </Typography>
    </Paper>
  );
}
