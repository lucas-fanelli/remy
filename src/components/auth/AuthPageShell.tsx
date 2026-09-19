'use client';
import { Box, Container } from '@mui/material';
import React from 'react';

/**
 * Full-height, centered layout shared by the standalone auth pages
 * (forgot / reset password). Same frame as src/app/auth/page.tsx.
 */
export default function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {children}
        </Box>
      </Container>
    </Box>
  );
}
