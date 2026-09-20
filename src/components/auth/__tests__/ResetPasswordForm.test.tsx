import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
import { hardNavigate } from '@/lib/utils/navigation';
import ResetPasswordForm from '../ResetPasswordForm';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const passthrough = (component: any) => component;
  passthrough.create = (component: any) => component;
  return { motion: passthrough };
});

// Mock next/navigation: the form must NOT use the soft router to leave the page
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// jsdom cannot perform a real page load
jest.mock('@/lib/utils/navigation', () => ({
  hardNavigate: jest.fn(),
}));

const TOKEN = 'raw-token-from-the-email';
const GOOD_PASSWORD = 'NewPassword1';
const INVALID_LINK_ERROR = 'This reset link is invalid or has expired';

const renderForm = (token: string | null = TOKEN) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <ResetPasswordForm token={token} />
    </ThemeProvider>
  );

const jsonResponse = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('ResetPasswordForm Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    (hardNavigate as jest.Mock).mockClear();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  const newPassword = () => screen.getByLabelText(/^new password/i);
  const confirmPassword = () => screen.getByLabelText(/^confirm new password/i);

  // Long values are pasted: typing 129 characters twice is ~260 simulated keystrokes and
  // blows the 5s test timeout when the whole suite runs in parallel.
  const enter = async (
    user: ReturnType<typeof userEvent.setup>,
    field: HTMLElement,
    value: string
  ) => {
    if (value.length <= 32) return user.type(field, value);
    await user.click(field);
    return user.paste(value);
  };

  const fillAndSubmit = async (password: string, confirmation: string = password) => {
    const user = userEvent.setup();
    if (password) await enter(user, newPassword(), password);
    if (confirmation) await enter(user, confirmPassword(), confirmation);
    await user.click(screen.getByRole('button', { name: /save new password/i }));
    return user;
  };

  describe('happy path', () => {
    it('should render both password fields, the rules and the submit button', () => {
      renderForm();

      expect(screen.getByRole('heading', { name: /choose a new password/i })).toBeInTheDocument();
      expect(newPassword()).toHaveAttribute('type', 'password');
      expect(confirmPassword()).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: /save new password/i })).toBeEnabled();
    });

    it('should post the token and the new password with the JSON and CSRF headers', async () => {
      // Arrange
      mockFetch.mockResolvedValue(jsonResponse(200));
      renderForm();

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ token: TOKEN, password: GOOD_PASSWORD }),
      });
    });

    it('should go to the login page with a success flag after the reset', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200));
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(hardNavigate).toHaveBeenCalledWith('/auth?reset=success');
    });

    it('should leave with a full page load so a session that was open in this browser cannot linger', async () => {
      // Arrange - AuthProvider only asks /api/auth/me on mount: after a soft
      // navigation it would still hold the user whose session the reset killed
      mockFetch.mockResolvedValue(jsonResponse(200));
      renderForm();

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(hardNavigate).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should stay disabled after a successful reset while the browser leaves the page', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200));
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(screen.getByRole('button', { name: /saving new password/i })).toBeDisabled();
    });

    it('should disable the fields and the button while saving', async () => {
      // Arrange
      let resolveFetch: (value: unknown) => void = () => {};
      mockFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
      renderForm();

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(newPassword()).toBeDisabled();
      expect(confirmPassword()).toBeDisabled();
      expect(screen.getByRole('button', { name: /saving new password/i })).toBeDisabled();

      resolveFetch(jsonResponse(500));
      await screen.findByRole('alert');
    });
  });

  describe('token in the address bar', () => {
    const openEmailedLink = () =>
      window.history.replaceState({}, '', `/auth/reset-password?token=${TOKEN}`);

    it('should remove the token from the URL as soon as the form mounts', () => {
      // Arrange
      openEmailedLink();

      // Act
      renderForm();

      // Assert - nothing that records window.location from here on can see it
      expect(window.location.pathname).toBe('/auth/reset-password');
      expect(window.location.search).toBe('');
      expect(window.location.href).not.toContain(TOKEN);
    });

    it('should make the clean URL the canonical one for the app router', () => {
      // Arrange - seen in a real browser: the router kept the old URL and wrote the
      // token back into the address bar on its next state change (router.refresh())
      openEmailedLink();

      // Act
      renderForm();

      // Assert
      expect(mockReplace).toHaveBeenCalledWith('/auth/reset-password', { scroll: false });
    });

    it('should still submit the token after it left the URL', async () => {
      // Arrange
      openEmailedLink();
      mockFetch.mockResolvedValue(jsonResponse(200));
      renderForm();

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).token).toBe(TOKEN);
    });

    it('should keep the token when the page re-renders without it', async () => {
      // Arrange - the server component re-rendered from the cleaned URL
      mockFetch.mockResolvedValue(jsonResponse(200));
      const { rerender } = renderForm();
      rerender(
        <ThemeProvider theme={createTheme()}>
          <ResetPasswordForm token={null} />
        </ThemeProvider>
      );

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).token).toBe(TOKEN);
    });

    it('should leave the URL alone when the link carries no token', () => {
      window.history.replaceState({}, '', '/auth/reset-password?utm=mail');

      renderForm(null);

      expect(window.location.search).toBe('?utm=mail');
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('password rules', () => {
    it('should list the password rules before anything is typed', () => {
      renderForm();

      const rules = within(screen.getByRole('list', { name: /password requirements/i }));
      expect(rules.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(rules.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(rules.getByText(/one lowercase letter/i)).toBeInTheDocument();
      expect(rules.getByText(/one number/i)).toBeInTheDocument();
    });

    it('should tie the rules to the password field for assistive technology', () => {
      renderForm();

      const rulesId = screen.getByRole('list', { name: /password requirements/i }).id;
      expect(newPassword().getAttribute('aria-describedby')).toContain(rulesId);
    });

    it('should tick rules off as the password satisfies them', async () => {
      // Arrange
      const user = userEvent.setup();
      renderForm();

      // Act
      await user.type(newPassword(), 'abc');

      // Assert
      const items = screen.getAllByRole('listitem');
      expect(items.find((li) => /lowercase/i.test(li.textContent ?? ''))).toHaveTextContent(
        '(met)'
      );
      expect(items.find((li) => /uppercase/i.test(li.textContent ?? ''))).toHaveTextContent(
        '(not met yet)'
      );
    });

    it.each([
      ['Ab1', 'Password must be at least 8 characters'],
      ['password1', 'Password must contain at least one uppercase letter'],
      ['PASSWORD1', 'Password must contain at least one lowercase letter'],
      ['Passwordd', 'Password must contain at least one number'],
      [`Aa1${'x'.repeat(126)}`, 'Password must be at most 128 characters'],
    ])('should reject "%s" under the password field without calling the API', async (pw, msg) => {
      renderForm();

      await fillAndSubmit(pw);

      expect(screen.getByText(msg)).toBeInTheDocument();
      expect(newPassword()).toHaveAttribute('aria-invalid', 'true');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should ask for a password when the field is empty', async () => {
      renderForm();

      await fillAndSubmit('', '');

      expect(screen.getByText('Enter a new password')).toBeInTheDocument();
      expect(screen.getByText('Confirm your new password')).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject a confirmation that does not match', async () => {
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD, 'NewPassword2');

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(confirmPassword()).toHaveAttribute('aria-invalid', 'true');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear a field error when that field is edited', async () => {
      // Arrange
      renderForm();
      const user = await fillAndSubmit('Ab1', 'different');

      // Act
      await user.type(newPassword(), 'x');
      await user.type(confirmPassword(), 'x');

      // Assert
      expect(screen.queryByText('Password must be at least 8 characters')).not.toBeInTheDocument();
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    });
  });

  describe('show / hide toggle', () => {
    it('should reveal and hide both passwords', async () => {
      // Arrange
      const user = userEvent.setup();
      renderForm();
      const toggle = screen.getByRole('button', { name: /show passwords/i });

      // Act + Assert
      await user.click(toggle);
      expect(newPassword()).toHaveAttribute('type', 'text');
      expect(confirmPassword()).toHaveAttribute('type', 'text');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');

      await user.click(toggle);
      expect(newPassword()).toHaveAttribute('type', 'password');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('invalid or expired link', () => {
    it('should show the invalid state without calling the API when the token is missing', () => {
      renderForm(null);

      expect(screen.getByRole('alert')).toHaveTextContent(INVALID_LINK_ERROR);
      expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should offer a way to request a new link and to go back to log in', () => {
      renderForm(null);

      expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
        'href',
        '/auth/forgot-password'
      );
      expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute(
        'href',
        '/auth'
      );
    });

    it('should switch to the same invalid state when the server rejects the token', async () => {
      // Arrange - used, expired and unknown tokens all answer with this one body
      mockFetch.mockResolvedValue(jsonResponse(400, { success: false, error: INVALID_LINK_ERROR }));
      renderForm();

      // Act
      await fillAndSubmit(GOOD_PASSWORD);

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_LINK_ERROR);
      expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('should show a server-side password error under the password field', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(400, { error: 'Password must contain at least one number' })
      );
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(
        await screen.findByText('Password must contain at least one number')
      ).toBeInTheDocument();
      expect(newPassword()).toHaveAttribute('aria-invalid', 'true');
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

      await fillAndSubmit(GOOD_PASSWORD);

      expect(await screen.findByText('Choose a different password')).toBeInTheDocument();
    });

    it('should explain the rate limit on a 429', async () => {
      mockFetch.mockResolvedValue(jsonResponse(429));
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
    });

    it('should show a generic error on a server failure and stay on the form', async () => {
      mockFetch.mockResolvedValue(jsonResponse(500));
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show a connection error when the request never reaches the server', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      renderForm();

      await fillAndSubmit(GOOD_PASSWORD);

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    });

    it('should let the user dismiss the error', async () => {
      // Arrange
      mockFetch.mockResolvedValue(jsonResponse(500));
      renderForm();
      const user = await fillAndSubmit(GOOD_PASSWORD);
      await screen.findByRole('alert');

      // Act
      await user.click(screen.getByRole('button', { name: /close/i }));

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
