'use client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
} from 'react';
import { BRANDING, THEME_COLORS } from '@/config/branding';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  // Initialize with light mode for SSR, then sync with localStorage
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const hasMounted = React.useRef(false);

  // Sync theme from localStorage after DOM mutation but before browser paint.
  // useLayoutEffect fires synchronously after hydration, avoiding the flash
  // that a setTimeout(50ms) approach would cause.
  useIsomorphicLayoutEffect(() => {
    hasMounted.current = true;
    const savedMode = localStorage.getItem('themeMode') as 'light' | 'dark' | null;
    if (savedMode && savedMode !== mode) {
      setMode(savedMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show content only after mode has been set and rendered
  React.useEffect(() => {
    if (!hasMounted.current) return;

    // Wait for React to finish rendering with the correct theme
    const showTimer = setTimeout(() => {
      document.documentElement.classList.remove('loading');
      document.documentElement.classList.add('theme-ready');
    }, 150);

    // Enable transitions
    const transitionTimer = setTimeout(() => setIsInitialLoad(false), 400);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(transitionTimer);
    };
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);

      // Sync HTML element classes and styles to prevent flash on navigation
      if (newMode === 'dark') {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.style.backgroundColor = THEME_COLORS.darkBackground;
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.style.colorScheme = 'light';
        document.documentElement.style.backgroundColor = THEME_COLORS.lightBackground;
      }

      return newMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          // Light mode: Rich, saturated colors
          // Dark mode: Modern neutral with teal accents
          primary:
            mode === 'light'
              ? {
                  main: BRANDING.colors.primary, // #673AB7 - Rich purple
                  light: '#9575CD', // Medium purple
                  dark: BRANDING.colors.secondary, // #512DA8 - Deep purple
                  contrastText: '#FFFFFF',
                }
              : {
                  main: '#26A69A', // Modern teal for dark mode
                  light: '#4DB6AC', // Light teal
                  dark: '#00897B', // Deep teal
                  contrastText: '#FFFFFF',
                },
          secondary:
            mode === 'light'
              ? {
                  main: BRANDING.colors.accent, // #FFC107 - Golden yellow
                  light: '#FFECB3', // Pale yellow
                  dark: '#FFA000', // Dark amber
                  contrastText: '#000000',
                }
              : {
                  main: '#80CBC4', // Soft teal accent for dark mode
                  light: '#B2DFDB', // Very light teal
                  dark: '#4DB6AC', // Medium teal
                  contrastText: '#000000',
                },
          error:
            mode === 'light'
              ? {
                  main: '#D32F2F', // Standard red
                  light: '#E57373',
                  dark: '#C62828',
                }
              : {
                  main: '#EF5350', // Softer red for dark mode
                  light: '#E57373',
                  dark: '#D32F2F',
                },
          warning:
            mode === 'light'
              ? {
                  main: '#F57C00', // Orange
                  light: '#FFB74D',
                  dark: '#E65100',
                }
              : {
                  main: '#FF9800', // Softer orange for dark mode
                  light: '#FFB74D',
                  dark: '#F57C00',
                },
          info:
            mode === 'light'
              ? {
                  main: '#0288D1', // Blue
                  light: '#4FC3F7',
                  dark: '#01579B',
                }
              : {
                  main: '#29B6F6', // Softer blue for dark mode
                  light: '#4FC3F7',
                  dark: '#0288D1',
                },
          success:
            mode === 'light'
              ? {
                  main: '#388E3C', // Green
                  light: '#81C784',
                  dark: '#2E7D32',
                }
              : {
                  main: '#66BB6A', // Softer green for dark mode
                  light: '#81C784',
                  dark: '#388E3C',
                },
          background:
            mode === 'light'
              ? {
                  default: THEME_COLORS.lightBackground, // Light gray (clean background)
                  paper: '#FFFFFF', // White surfaces
                }
              : {
                  default: THEME_COLORS.darkBackground, // Lighter dark background
                  paper: '#2C2C2C', // Lighter elevated surfaces
                },
          text:
            mode === 'light'
              ? {
                  primary: '#212121', // Almost black (high contrast)
                  secondary: '#616161', // Medium gray
                  disabled: '#9E9E9E', // Light gray
                }
              : {
                  primary: '#E8E8E8', // High contrast white for dark mode
                  secondary: '#B0B0B0', // Medium gray
                  disabled: '#757575', // Darker gray
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
                // Disable transitions during initial load to prevent flash
                transition: isInitialLoad
                  ? 'none'
                  : 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '*': {
                // Apply transitions to all elements
                // Disable transitions during initial load to prevent flash
                transition: isInitialLoad
                  ? 'none'
                  : 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
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
                transition:
                  'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
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
    [mode, isInitialLoad]
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
