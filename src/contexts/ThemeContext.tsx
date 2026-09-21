'use client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
} from 'react';
import { createAppTheme } from '@/theme/createAppTheme';
import { tokensFor } from '@/theme/tokens';

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
    const preferred: 'light' | 'dark' =
      savedMode ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (preferred !== mode) {
      setMode(preferred);
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
        document.documentElement.style.backgroundColor = tokensFor('dark').surface.base;
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.style.colorScheme = 'light';
        document.documentElement.style.backgroundColor = tokensFor('light').surface.base;
      }

      return newMode;
    });
  };

  const theme = useMemo(() => createAppTheme(mode, !isInitialLoad), [mode, isInitialLoad]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
