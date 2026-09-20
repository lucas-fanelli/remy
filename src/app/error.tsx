'use client';

import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const router = useRouter();

  useEffect(() => {
    // Log error to console in development
    console.error('Application error:', error);

    // Report error to Sentry
    Sentry.captureException(error);
  }, [error]);

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
          <ErrorIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              marginBottom: 2,
            }}
          />

          <Typography variant="h4" gutterBottom fontWeight="bold">
            {t('error.title')}
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph>
            {t('error.description')}
          </Typography>

          {process.env.NODE_ENV === 'development' && (
            <Paper
              sx={{
                padding: 2,
                marginY: 2,
                backgroundColor: 'grey.100',
                textAlign: 'left',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {error.message}
              </Typography>
              {error.digest && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {t('error.errorId', { digest: error.digest })}
                </Typography>
              )}
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
            <Button variant="contained" color="primary" startIcon={<RefreshIcon />} onClick={reset}>
              {t('actions.tryAgain')}
            </Button>

            <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => router.push('/')}>
              {tCommon('actions.goHome')}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
