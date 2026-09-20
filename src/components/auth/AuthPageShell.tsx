'use client';
import { Box, Container } from '@mui/material';
import React from 'react';
import LanguageSwitcher from '../common/LanguageSwitcher';

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
          {/* These pages have no navigation, so the switcher has to live here */}
          <Box sx={{ mt: 3 }}>
            <LanguageSwitcher />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
