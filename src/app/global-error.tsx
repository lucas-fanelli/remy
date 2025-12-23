'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <Container maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              textAlign: 'center',
              gap: 3,
            }}
          >
            <Typography variant="h3" component="h1" gutterBottom>
              Something went wrong!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              We apologize for the inconvenience. Our team has been notified and is working on a
              fix.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => reset()}>
              Try again
            </Button>
          </Box>
        </Container>
      </body>
    </html>
  );
}
