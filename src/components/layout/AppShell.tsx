'use client';
import { Box, Toolbar } from '@mui/material';
import React from 'react';

/**
 * The frame every page sits in: header, content, footer, in one column.
 *
 * There was no such frame. Each page built its own — 19 of them set
 * `minHeight: '100vh'` on their root, seven rendered an empty `<Toolbar />` to clear the
 * fixed header, one used padding instead, and six did neither and started underneath it.
 *
 * That `100vh` is why the footer could never rise. A page declaring itself at least one
 * screen tall pushes anything after it below the fold, so on the 404 — whose content is
 * three lines — the footer sat at exactly 1273px on a 1273px viewport. The Footer has
 * carried `mt: 'auto'` all along, which is precisely the instruction to sit at the bottom
 * of a flex column; it had no flex column to sit in.
 */
interface AppShellProps {
  children: React.ReactNode;
  /** The fixed header, or nothing on the pages that hide it. */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** True when a fixed bottom bar is on screen and the content has to clear it. */
  hasBottomBar?: boolean;
}

/**
 * Height of the fixed bottom navigation on small screens. The footer is hidden there, so
 * without this the last row of every page sits under the bar.
 */
const BOTTOM_BAR_CLEARANCE = 9;

export default function AppShell({ children, header, footer, hasBottomBar = true }: AppShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        // `100vh` on a phone is the viewport with the browser chrome counted in, so the
        // column is taller than what can be seen and the footer goes back under the fold.
        // `100dvh` is the part actually on screen.
        '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
      }}
    >
      {header}
      {/* The one spacer for the fixed header, instead of seven — and the six pages that
          had none stop starting underneath it. */}
      {header ? <Toolbar /> : null}

      <Box
        component="main"
        sx={{
          // Takes the slack, so the footer is pushed to the bottom on a short page and
          // simply follows the content on a long one.
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          pb: hasBottomBar ? { xs: BOTTOM_BAR_CLEARANCE, md: 0 } : 0,
        }}
      >
        {children}
      </Box>

      {footer}
    </Box>
  );
}
