import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
import ForgotPasswordForm from '../ForgotPasswordForm';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const passthrough = (component: any) => component;
  passthrough.create = (component: any) => component;
  return { motion: passthrough };
});

const renderForm = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <ForgotPasswordForm />
    </ThemeProvider>
  );

const jsonResponse = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('ForgotPasswordForm Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  const submit = async (value: string) => {
    const user = userEvent.setup();
    if (value) await user.type(screen.getByLabelText(/email or username/i), value);
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    return user;
  };

  it('should render one labelled field, a submit button and a link back to log in', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/auth');
  });

  it('should post the trimmed identifier with the JSON and CSRF headers', async () => {
    // Arrange
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();

    // Act
    await submit('  chef@example.com ');

    // Assert
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ emailOrUsername: 'chef@example.com' }),
    });
  });

  it('should show a neutral confirmation after submitting', async () => {
    // Arrange
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();

    // Act
    await submit('chef');

    // Assert
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/if an account matches, we sent a link/i);
    expect(status).toHaveTextContent(/spam/i);
    expect(status).toHaveTextContent(/expires in 60 minutes/i);
  });

  it('should move focus to the confirmation so it is announced and not lost with the form', async () => {
    // Arrange
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();

    // Act
    await submit('chef');

    // Assert
    expect(await screen.findByRole('status')).toHaveFocus();
  });

  it('should not reveal in the confirmation what was typed or whether it exists', async () => {
    // Arrange
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();

    // Act
    await submit('chef@example.com');

    // Assert
    const status = await screen.findByRole('status');
    expect(status).not.toHaveTextContent('chef@example.com');
    expect(status).not.toHaveTextContent(/we found|no account|does not exist/i);
  });

  it('should keep the link back to log in on the confirmation', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();

    await submit('chef');

    await screen.findByRole('status');
    expect(screen.getByRole('link', { name: /back to log in/i })).toBeInTheDocument();
  });

  it('should return to an empty form when asking to try a different identifier', async () => {
    // Arrange
    mockFetch.mockResolvedValue(jsonResponse(200));
    renderForm();
    const user = await submit('chef');
    await screen.findByRole('status');

    // Act
    await user.click(screen.getByRole('button', { name: /try a different email or username/i }));

    // Assert
    expect(screen.getByLabelText(/email or username/i)).toHaveValue('');
  });

  it('should show a field error and not call the API when the field is empty', async () => {
    renderForm();

    await submit('');

    expect(screen.getByText('Enter your email or username')).toBeInTheDocument();
    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should treat whitespace as an empty field', async () => {
    renderForm();

    await submit('   ');

    expect(screen.getByText('Enter your email or username')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should clear the field error as soon as the user types again', async () => {
    // Arrange
    renderForm();
    const user = await submit('');

    // Act
    await user.type(screen.getByLabelText(/email or username/i), 'c');

    // Assert
    expect(screen.queryByText('Enter your email or username')).not.toBeInTheDocument();
  });

  it('should disable the field and the button while submitting', async () => {
    // Arrange
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    renderForm();

    // Act
    await submit('chef');

    // Assert
    expect(screen.getByLabelText(/email or username/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /sending reset link/i })).toBeDisabled();

    resolveFetch(jsonResponse(200));
    await screen.findByRole('status');
  });

  it('should show the server validation message under the field on a 400', async () => {
    mockFetch.mockResolvedValue(jsonResponse(400, { error: 'Email or username is too long' }));
    renderForm();

    await submit('chef');

    expect(await screen.findByText('Email or username is too long')).toBeInTheDocument();
  });

  it('should fall back to a generic field error when a 400 has no readable body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => {
        throw new Error('not json');
      },
    });
    renderForm();

    await submit('chef');

    expect(await screen.findByText('Enter a valid email or username')).toBeInTheDocument();
  });

  it('should explain the rate limit on a 429', async () => {
    mockFetch.mockResolvedValue(jsonResponse(429));
    renderForm();

    await submit('chef');

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('should show a generic error on a server failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse(500));
    renderForm();

    await submit('chef');

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('should show a connection error when the request never reaches the server', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm();

    await submit('chef');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('should let the user dismiss the error and submit again', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(jsonResponse(500)).mockResolvedValueOnce(jsonResponse(200));
    renderForm();
    const user = await submit('chef');
    await screen.findByRole('alert');

    // Act
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    // Assert
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
