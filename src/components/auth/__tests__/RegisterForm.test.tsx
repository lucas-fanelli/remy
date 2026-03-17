import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      <AuthProvider>{component}</AuthProvider>
    </ThemeProvider>
  );
};

describe('RegisterForm Component', () => {
  let mockFetch: jest.Mock;
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSwitchToLogin.mockClear();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    // AuthProvider calls /api/auth/me on mount - mock it as not authenticated
    mockFetch.mockResolvedValueOnce({ ok: false });
  });

  it('should render registration form with all elements', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByText(/have an account/i)).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('should update email field when typing', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    expect(emailInput.value).toBe('test@example.com');
  });

  it('should update full name field when typing', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const nameInput = screen.getByPlaceholderText('Full Name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    expect(nameInput.value).toBe('Test User');
  });

  it('should update username field when typing', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const usernameInput = screen.getByPlaceholderText('Username') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });

    expect(usernameInput.value).toBe('testuser');
  });

  it('should update password field when typing', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    expect(passwordInput.value).toBe('Password123');
  });

  it('should disable submit button when required fields are empty', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when required fields are filled', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('should call onSwitchToLogin when Log in is clicked', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const loginLink = screen.getByText('Log in');
    fireEvent.click(loginLink);

    expect(mockOnSwitchToLogin).toHaveBeenCalledTimes(1);
  });

  it('should show password helper text', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(
      screen.getByText(/password must contain uppercase, lowercase, and number/i)
    ).toBeInTheDocument();
  });

  it('should show terms and policy text', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    expect(screen.getByText(/by signing up, you agree to our terms/i)).toBeInTheDocument();
  });

  it('should display error message on registration failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Username already exists' }),
    });

    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });
  });

  it('should clear error when close button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Username already exists' }),
    });

    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Username already exists')).not.toBeInTheDocument();
    });
  });

  it('should allow registration without full name (optional field)', () => {
    renderWithProviders(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />);

    const emailInput = screen.getByPlaceholderText('Email');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    expect(submitButton).not.toBeDisabled();
  });
});
