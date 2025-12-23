'use client';

import WifiOffIcon from '@mui/icons-material/WifiOff';
import { Box, Typography, Button } from '@mui/material';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <WifiOffIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h4" component="h1" gutterBottom>
        You&apos;re Offline
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        It looks like you&apos;ve lost your internet connection. Some features may be unavailable
        until you&apos;re back online.
      </Typography>
      <Button onClick={handleRetry} variant="contained" color="primary">
        Try Again
      </Button>
    </Box>
  );
}
