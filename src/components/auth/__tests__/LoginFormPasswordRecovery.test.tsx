import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import AuthPageShell from '../AuthPageShell';
import LoginForm from '../LoginForm';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const passthrough = (component: any) => component;
  passthrough.create = (component: any) => component;
  return { motion: passthrough };
});

// LoginForm only needs login() from the auth context here
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

const renderLoginForm = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <LoginForm onSwitchToRegister={jest.fn()} />
    </ThemeProvider>
  );

describe('LoginForm - password recovery entry points', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('should link to the forgot password page', () => {
    renderLoginForm();

    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/auth/forgot-password'
    );
  });

  it('should confirm the password change when arriving from a successful reset', async () => {
    // Arrange - ResetPasswordForm redirects to this URL
    window.history.replaceState({}, '', '/auth?reset=success');

    // Act
    renderLoginForm();

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent(/your password was updated/i);
  });

  it('should not show the confirmation on a normal visit', () => {
    window.history.replaceState({}, '', '/auth');

    renderLoginForm();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should ignore other values of the reset flag', () => {
    window.history.replaceState({}, '', '/auth?reset=1');

    renderLoginForm();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('AuthPageShell', () => {
  it('should render its content inside the main landmark', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <AuthPageShell>
          <p>Form goes here</p>
        </AuthPageShell>
      </ThemeProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Form goes here');
  });
});
