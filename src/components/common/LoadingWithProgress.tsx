'use client';
import { Box, LinearProgress } from '@mui/material';
import React from 'react';

interface LoadingWithProgressProps {
  /** Optional message to display below the progress bar */
  message?: string;
  /** Color of the progress bar - defaults to primary */
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  /** Whether to show as fixed at top or inline */
  inline?: boolean;
}

/**
 * Loading component with Material UI linear indeterminate progress bar
 * Automatically adapts to light/dark mode
 */
export default function LoadingWithProgress({
  message,
  color = 'primary',
  inline = false,
}: LoadingWithProgressProps) {
  return (
    <Box
      sx={{
        width: '100%',
        mb: inline ? 2 : 0,
      }}
    >
      <LinearProgress
        color={color}
        sx={{
          height: 4,
          borderRadius: 1,
          '& .MuiLinearProgress-bar': {
            transition: 'transform 0.4s linear',
          },
        }}
      />
    </Box>
  );
}
