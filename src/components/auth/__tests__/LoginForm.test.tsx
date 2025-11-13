import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LoginForm from '../LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';

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
      <AuthProvider>
        {component}
      </AuthProvider>
    </ThemeProvider>
  );
};

describe('LoginForm Component', () => {
  let mockFetch: jest.Mock;
  const mockOnSwitchToRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSwitchToRegister.mockClear();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });

  it('should render login form with all elements', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    expect(screen.getByPlaceholderText('Email or username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('should update email/username field when typing', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'testuser' } });

    expect(emailInput.value).toBe('testuser');
  });

  it('should update password field when typing', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(passwordInput.value).toBe('password123');
  });

  it('should disable submit button when fields are empty', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const submitButton = screen.getByRole('button', { name: /log in/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when fields are filled', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('should call onSwitchToRegister when Sign up is clicked', () => {
    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const signUpLink = screen.getByText('Sign up');
    fireEvent.click(signUpLink);

    expect(mockOnSwitchToRegister).toHaveBeenCalledTimes(1);
  });

  it('should show loading state during login', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('should display error message on login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'wronguser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should clear error when close button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'wronguser' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  it('should successfully login with valid credentials', async () => {
    const mockUser = {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      isVerified: true,
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { token: 'test-token', user: mockUser } }),
    });

    renderWithProviders(<LoginForm onSwitchToRegister={mockOnSwitchToRegister} />);

    const emailInput = screen.getByPlaceholderText('Email or username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
  });
});
