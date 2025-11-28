'use client';
import React, { createContext, useContext, useState, useMemo } from 'react';
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
          // Light mode: Rich, saturated colors
          // Dark mode: Softer, more muted colors for comfort
          primary: mode === 'light' ? {
            main: BRANDING.colors.primary,    // #673AB7 - Rich purple
            light: '#9575CD',                  // Medium purple
            dark: BRANDING.colors.secondary,   // #512DA8 - Deep purple
            contrastText: '#FFFFFF',
          } : {
            main: '#B39DDB',                   // Softer purple for dark mode
            light: '#D1C4E9',                  // Light purple
            dark: '#9575CD',                   // Medium purple
            contrastText: '#000000',
          },
          secondary: mode === 'light' ? {
            main: BRANDING.colors.accent,      // #FFC107 - Golden yellow
            light: '#FFECB3',                  // Pale yellow
            dark: '#FFA000',                   // Dark amber
            contrastText: '#000000',
          } : {
            main: '#FFD54F',                   // Softer yellow for dark mode
            light: '#FFE082',                  // Light yellow
            dark: '#FFCA28',                   // Medium yellow
            contrastText: '#000000',
          },
          error: mode === 'light' ? {
            main: '#D32F2F',                   // Standard red
            light: '#E57373',
            dark: '#C62828',
          } : {
            main: '#EF5350',                   // Softer red for dark mode
            light: '#E57373',
            dark: '#D32F2F',
          },
          warning: mode === 'light' ? {
            main: '#F57C00',                   // Orange
            light: '#FFB74D',
            dark: '#E65100',
          } : {
            main: '#FF9800',                   // Softer orange for dark mode
            light: '#FFB74D',
            dark: '#F57C00',
          },
          info: mode === 'light' ? {
            main: '#0288D1',                   // Blue
            light: '#4FC3F7',
            dark: '#01579B',
          } : {
            main: '#29B6F6',                   // Softer blue for dark mode
            light: '#4FC3F7',
            dark: '#0288D1',
          },
          success: mode === 'light' ? {
            main: '#388E3C',                   // Green
            light: '#81C784',
            dark: '#2E7D32',
          } : {
            main: '#66BB6A',                   // Softer green for dark mode
            light: '#81C784',
            dark: '#388E3C',
          },
          background: mode === 'light' ? {
            default: '#FAFAFA',                // Light gray (clean background)
            paper: '#FFFFFF',                  // White surfaces
          } : {
            default: '#0A0A0A',                // True dark background
            paper: '#1A1A1A',                  // Slightly lighter dark surfaces
          },
          text: mode === 'light' ? {
            primary: '#212121',                // Almost black (high contrast)
            secondary: '#616161',              // Medium gray
            disabled: '#9E9E9E',               // Light gray
          } : {
            primary: '#E0E0E0',                // Soft white (easier on eyes)
            secondary: '#A0A0A0',              // Medium gray
            disabled: '#707070',               // Darker gray
          },
          divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
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
