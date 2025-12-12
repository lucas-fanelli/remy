'use client';
import { createTheme } from '@mui/material/styles';
import { BRANDING } from '@/config/branding';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: BRANDING.colors.primary,    // #673AB7 - Rich purple
      light: '#D1C4E9',                  // Light purple
      dark: BRANDING.colors.secondary,   // #512DA8 - Deep purple
    },
    secondary: {
      main: BRANDING.colors.accent,      // #FFC107 - Golden yellow
      light: '#FFD54F',                  // Light yellow
      dark: '#FFA000',                   // Dark yellow/amber
    },
    background: {
      default: '#FAFAFA',                // Light gray (clean background)
      paper: '#FFFFFF',                  // White surfaces
    },
    text: {
      primary: '#212121',                // Almost black (high contrast)
      secondary: '#757575',              // Medium gray
    },
  },
  typography: {
    fontFamily: [
      'var(--font-nunito)',
      'Nunito',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        },
      },
    },
  },
});
