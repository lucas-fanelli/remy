'use client';

import {
  SearchOff as NotFoundIcon,
  Home as HomeIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import React from 'react';

export default function NotFound() {
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
            Page Not Found
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph sx={{ marginTop: 2 }}>
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved
            or deleted.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/')}
            >
              Go Home
            </Button>

            <Button variant="outlined" startIcon={<BackIcon />} onClick={() => router.back()}>
              Go Back
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ marginTop: 4 }}
          >
            Lost? Try searching for recipes or exploring our community feed.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
