'use client';
import { createTheme } from '@mui/material/styles';
import { BRANDING } from '@/config/branding';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: BRANDING.colors.primary,
      light: '#E85E35',
      dark: '#BF360C',
    },
    secondary: {
      main: BRANDING.colors.secondary,
      light: '#FF9800',
      dark: '#E65100',
    },
    background: {
      default: '#FFF8E1',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#262626',
      secondary: '#8E8E8E',
    },
  },
  typography: {
    fontFamily: [
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
