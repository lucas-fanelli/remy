import { useTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { darkTokens, lightTokens } from '@/theme/tokens';
import { ThemeProvider, useThemeMode } from '../ThemeContext';

// Test component that uses the theme context
function TestComponent() {
  const { mode, toggleTheme } = useThemeMode();

  return (
    <div>
      <div data-testid="current-mode">{mode}</div>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}

// Exposes the MUI theme tokens the recipe form relies on (S15)
function ThemeProbe() {
  const theme = useTheme();
  const dialog = theme.components?.MuiDialog?.styleOverrides as Record<string, any> | undefined;

  return (
    <div>
      <div data-testid="primary-contrast">{theme.palette.primary.contrastText}</div>
      <div data-testid="dialog-radius">{String(dialog?.paper?.borderRadius)}</div>
      <div data-testid="dialog-fullscreen-radius">
        {String(dialog?.paperFullScreen?.borderRadius)}
      </div>
    </div>
  );
}

/** jsdom reports inline colours as rgb(); the tokens are hex. */
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
    // Setup classList mock
    document.documentElement.classList.remove('loading');
    document.documentElement.classList.remove('theme-ready');
  });

  it('should default to light mode when no preference is stored', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-mode')).toHaveTextContent('light');
  });

  it('should use stored preference from localStorage', async () => {
    localStorage.setItem('themeMode', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Wait for the theme to load from localStorage (50ms delay in useEffect)
    await waitFor(() => {
      expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');
    });
  });

  it('should toggle theme from light to dark', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-mode')).toHaveTextContent('light');

    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');
  });

  it('should toggle theme from dark to light', async () => {
    localStorage.setItem('themeMode', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Wait for the theme to load from localStorage (50ms delay in useEffect)
    await waitFor(() => {
      expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');
    });

    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(screen.getByTestId('current-mode')).toHaveTextContent('light');
  });

  it('should persist theme preference to localStorage', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(setItemSpy).toHaveBeenCalledWith('themeMode', 'dark');

    setItemSpy.mockRestore();
  });

  it('should throw error when useThemeMode is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useThemeMode must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  it('should add theme-ready class after mount delay', async () => {
    jest.useFakeTimers();
    localStorage.setItem('themeMode', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Fast-forward past the 50ms hydration timer
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    // Fast-forward past the 150ms show timer
    await act(async () => {
      jest.advanceTimersByTime(150);
    });

    expect(document.documentElement.classList.contains('theme-ready')).toBe(true);
    expect(document.documentElement.classList.contains('loading')).toBe(false);

    jest.useRealTimers();
  });

  it('should sync dark-mode class to HTML element when toggling', () => {
    // Clear any existing classes and styles
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    document.documentElement.style.backgroundColor = '';

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Toggle to dark - this should add dark-mode class
    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(document.documentElement.className).toContain('dark-mode');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    // Read from the tokens rather than repeating the hex — a copy here is exactly the
    // drift this work is unpicking.
    expect(document.documentElement.style.backgroundColor).toBe(hexToRgb(darkTokens.surface.base));

    // Toggle back to light - this should remove dark-mode class
    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(document.documentElement.className).not.toContain('dark-mode');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(250, 250, 250)');
  });

  it('should keep white text on the light purple primary', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('primary-contrast')).toHaveTextContent(lightTokens.text.onBrand);
  });

  it('should use dark ink on the light purple primary, where white would fail AA', () => {
    render(
      <ThemeProvider>
        <TestComponent />
        <ThemeProbe />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Toggle Theme'));

    // #BD9CF6 is light enough that white on it is 1.8:1. The token says dark ink.
    expect(screen.getByTestId('primary-contrast')).toHaveTextContent(darkTokens.text.onBrand);
  });

  it('should round dialog papers except full-screen ones', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('dialog-radius')).toHaveTextContent('16');
    expect(screen.getByTestId('dialog-fullscreen-radius')).toHaveTextContent('0');
  });

  it('should enable transitions after initial load - lines 187-192', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Wait for useEffect to complete (50ms delay in source + buffer)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Toggle theme after isInitialLoad becomes false
    fireEvent.click(screen.getByText('Toggle Theme'));

    // Theme should now be dark with transitions enabled (not 'none')
    expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');

    // Toggle back - this exercises the theme useMemo with isInitialLoad = false
    fireEvent.click(screen.getByText('Toggle Theme'));

    expect(screen.getByTestId('current-mode')).toHaveTextContent('light');
  });
});
