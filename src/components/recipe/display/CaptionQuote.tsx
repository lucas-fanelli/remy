'use client';
import { Paper, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface CaptionQuoteProps {
  caption: string;
  /** 'elevation' (default) is the published page; the form's preview uses 'outlined' */
  variant?: 'elevation' | 'outlined';
  sx?: SxProps<Theme>;
}

/** The closing note, printed as a quote after the last step */
export default function CaptionQuote({ caption, variant = 'elevation', sx }: CaptionQuoteProps) {
  return (
    <Paper
      variant={variant}
      sx={[
        {
          p: 3,
          bgcolor:
            variant === 'outlined'
              ? 'action.hover'
              : (theme: Theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
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
