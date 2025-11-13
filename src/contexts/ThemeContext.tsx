'use client';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { BRANDING } from '@/config/branding';

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize mode from localStorage or default to 'light'
  // Using a function to only run once on mount
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    // Only access localStorage on client
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('themeMode') as 'light' | 'dark' | null;
      return savedMode || 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
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
          background: mode === 'light' ? {
            default: '#FFF8E1',
            paper: '#FFFFFF',
          } : {
            default: '#121212',
            paper: '#1E1E1E',
          },
          text: mode === 'light' ? {
            primary: '#262626',
            secondary: '#8E8E8E',
          } : {
            primary: '#FFFFFF',
            secondary: '#B0B0B0',
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
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                // Material Design smooth transitions for theme changes
                transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '*': {
                // Apply transitions to all elements
                transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
            },
          },
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
                transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
