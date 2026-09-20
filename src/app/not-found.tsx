'use client';

import {
  SearchOff as NotFoundIcon,
  Home as HomeIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            textAlign: 'center',
            borderRadius: 2,
          }}
        >
          <NotFoundIcon
            sx={{
              fontSize: 120,
              color: 'text.secondary',
              marginBottom: 2,
            }}
          />

          <Typography variant="h1" gutterBottom fontWeight="bold" color="primary">
            404
          </Typography>

          <Typography variant="h5" gutterBottom fontWeight="600">
            {t('notFound.title')}
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph sx={{ marginTop: 2 }}>
            {t('notFound.description')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/')}
            >
              {tCommon('actions.goHome')}
            </Button>

            <Button variant="outlined" startIcon={<BackIcon />} onClick={() => router.back()}>
              {tCommon('actions.goBack')}
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ marginTop: 4 }}
          >
            {t('notFound.hint')}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
