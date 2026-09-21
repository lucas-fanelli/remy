'use client';

import WifiOffIcon from '@mui/icons-material/WifiOff';
import { Box, Typography, Button } from '@mui/material';
import { useTranslations } from 'next-intl';

export default function OfflinePage() {
  const t = useTranslations('shell');

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
        textAlign: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <WifiOffIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h4" component="h1" gutterBottom>
        {t('offline.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        {t('offline.description')}
      </Typography>
      <Button onClick={handleRetry} variant="contained" color="primary">
        {t('actions.tryAgain')}
      </Button>
    </Box>
  );
}
