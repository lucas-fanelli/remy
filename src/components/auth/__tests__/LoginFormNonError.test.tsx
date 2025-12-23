import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LoginForm from '../LoginForm';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: (component: any) => component,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock useAuth to throw non-Error
const mockLogin = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    login: mockLogin,
    register: jest.fn(),
    logout: jest.fn(),
    updateProfile: jest.fn(),
  }),
}));

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('LoginForm non-Error exception handling - line 38', () => {
  const mockOnSwitchToRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display fallback error when login throws non-Error', async () => {
    // Make login throw a non-Error (string)
    mockLogin.mockRejectedValueOnce('string error');

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('should display fallback error when login throws undefined', async () => {
    // Make login throw undefined
    mockLogin.mockRejectedValueOnce(undefined);

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });
});
