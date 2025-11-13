import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should default to light mode when no preference is stored', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-mode')).toHaveTextContent('light');
  });

  it('should use stored preference from localStorage', () => {
    localStorage.setItem('themeMode', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');
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

  it('should toggle theme from dark to light', () => {
    localStorage.setItem('themeMode', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-mode')).toHaveTextContent('dark');

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
});
