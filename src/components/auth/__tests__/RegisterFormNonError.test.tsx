import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RegisterForm from '../RegisterForm';

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
const mockRegister = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    login: jest.fn(),
    register: mockRegister,
    logout: jest.fn(),
    updateProfile: jest.fn(),
  }),
}));

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('RegisterForm non-Error exception handling - line 40', () => {
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display fallback error when register throws non-Error', async () => {
    // Make register throw a non-Error (string)
    mockRegister.mockRejectedValueOnce('string error');

    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });

  it('should display fallback error when register throws null', async () => {
    // Make register throw null
    mockRegister.mockRejectedValueOnce(null);

    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });
});
