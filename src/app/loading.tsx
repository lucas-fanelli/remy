import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Restaurant as LogoIcon } from '@mui/icons-material';

export default function Loading() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        gap: 2,
      }}
    >
      <LogoIcon sx={{ fontSize: 60, color: 'primary.main', animation: 'pulse 2s infinite' }} />
      <CircularProgress size={40} thickness={4} />
      <Typography variant="body1" color="text.secondary">
        Loading delicious recipes...
      </Typography>
    </Box>
  );
}
