'use client';

import React, { useEffect } from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to console in development
    console.error('Application error:', error);

    // TODO: In production, send to error tracking service (e.g., Sentry)
    // if (process.env.NODE_ENV === 'production') {
    //   logErrorToService(error);
    // }
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
            Oops! Something went wrong
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph>
            We encountered an unexpected error. Don&apos;t worry, our team has been notified and we&apos;re working on it.
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
                  Error ID: {error.digest}
                </Typography>
              )}
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={reset}
            >
              Try Again
            </Button>

            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/')}
            >
              Go Home
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
