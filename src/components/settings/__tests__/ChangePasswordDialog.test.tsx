import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChangePasswordDialog from '../ChangePasswordDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ToastContext');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Wrapper to handle MUI FormControl async state updates
const renderWithAct = (ui: React.ReactElement) => {
  let result: any;
  act(() => {
    result = render(ui);
  });
  return result;
};

describe('ChangePasswordDialog', () => {
  let mockShowSuccess: jest.Mock;
  let mockShowError: jest.Mock;
  let mockOnClose: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockShowSuccess = jest.fn();
    mockShowError = jest.fn();
    mockOnClose = jest.fn();

    mockUseAuth.mockReturnValue({
      user: { id: '1', username: 'testuser', email: 'test@example.com' },
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
    });

    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: jest.fn(),
      showInfo: jest.fn(),
    });

    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });


  describe('Dialog Rendering', () => {
    it('should not render when open is false', async () => {
      renderWithAct(<ChangePasswordDialog open={false} onClose={mockOnClose} />);

      expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
    });

    it('should render when open is true', async () => {
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const changePasswordElements = screen.getAllByText('Change Password');
      expect(changePasswordElements.length).toBeGreaterThan(0);
    });

    it('should render all password fields', async () => {
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    });

    it('should render info alert with password requirements', async () => {
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(
        screen.getByText(/Your password must be at least 8 characters/i)
      ).toBeInTheDocument();
    });

    it('should render cancel and submit buttons', async () => {
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    });

    it('should render close icon button', async () => {
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle current password visibility', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement;
      expect(currentPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButton = toggleButtons.find((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      if (visibilityButton) {
        await user.click(visibilityButton);
        await waitFor(() => {
          expect(currentPasswordInput.type).toBe('text');
        });
      }
    });

    it('should toggle new password visibility', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const newPasswordInput = screen.getByLabelText(/^new password/i) as HTMLInputElement;
      expect(newPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButtons = toggleButtons.filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      if (visibilityButtons.length > 1) {
        await user.click(visibilityButtons[1]);
        await waitFor(() => {
          expect(newPasswordInput.type).toBe('text');
        });
      }
    });

    it('should toggle confirm password visibility', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement;
      expect(confirmPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButtons = toggleButtons.filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      // Third visibility button is for confirm password
      if (visibilityButtons.length > 2) {
        await user.click(visibilityButtons[2]);
        await waitFor(() => {
          expect(confirmPasswordInput.type).toBe('text');
        });
      }
    });
  });

  describe('Form Input', () => {
    it('should update current password field', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      await user.type(currentPasswordInput, 'OldPass123');

      expect(currentPasswordInput).toHaveValue('OldPass123');
    });

    it('should update new password field', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const newPasswordInput = screen.getByLabelText(/^new password/i);
      await user.type(newPasswordInput, 'NewPass123');

      expect(newPasswordInput).toHaveValue('NewPass123');
    });

    it('should update confirm password field', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
      await user.type(confirmPasswordInput, 'NewPass123');

      expect(confirmPasswordInput).toHaveValue('NewPass123');
    });
  });

  describe('Form Validation', () => {
    it('should show error when current password is empty', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(await screen.findByText('Current password is required')).toBeInTheDocument();
    });

    it('should show error when new password is empty', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      await user.type(currentPasswordInput, 'OldPass123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(await screen.findByText('New password is required')).toBeInTheDocument();
    });

    it('should show error when password is too short', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'Short1');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should show error when password lacks uppercase', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'newpass123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one uppercase letter')
      ).toBeInTheDocument();
    });

    it('should show error when password lacks lowercase', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'NEWPASS123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one lowercase letter')
      ).toBeInTheDocument();
    });

    it('should show error when password lacks number', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'NewPassword');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one number')
      ).toBeInTheDocument();
    });

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'NewPass123');
      await user.type(confirmPasswordInput, 'DifferentPass123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should show error when new password equals current password', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'SamePass123');
      await user.type(newPasswordInput, 'SamePass123');
      await user.type(confirmPasswordInput, 'SamePass123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('New password must be different from current password')
        ).toBeInTheDocument();
      });
    });

    it('should clear error when field is updated', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(await screen.findByText('Current password is required')).toBeInTheDocument();

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      await user.type(currentPasswordInput, 'OldPass123');

      await waitFor(() => {
        expect(screen.queryByText('Current password is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should successfully change password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: JSON.stringify({
            oldPassword: 'OldPass123',
            newPassword: 'NewPass123',
          }),
        });
      });

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Password changed successfully!');
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Wait for all async state updates to complete (setSaving(false) in finally block)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });

    it('should show error when API request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Current password is incorrect' }),
      });

      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'WrongPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Current password is incorrect');
      });

      // Wait for all async state updates to complete (setSaving(false) in finally block)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });

    it('should show error when not authenticated', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: jest.fn(),
      });

      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPass123');
      await user.type(newPasswordInput, 'NewPass123');
      await user.type(confirmPasswordInput, 'NewPass123');

      const submitButton = screen.getByRole('button', { name: /change password/i });
      await user.click(submitButton);

      expect(mockShowError).toHaveBeenCalledWith('You must be logged in to change your password');
    });

    it('should disable buttons while saving', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true }),
                }),
              100
            )
          )
      );

      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Changing...')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();

      // Wait for async operation to complete and state to update
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Wait for all async state updates to complete (setSaving(false) in finally block)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close icon is clicked', async () => {
      const user = userEvent.setup();
      renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should reset form when dialog closes', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithAct(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      await user.type(currentPasswordInput, 'OldPass123');

      // Wait for all userEvent operations to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        rerender(<ChangePasswordDialog open={false} onClose={mockOnClose} />);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        rerender(<ChangePasswordDialog open={true} onClose={mockOnClose} />);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const currentPasswordInputAfter = screen.getByLabelText(/current password/i);
      expect(currentPasswordInputAfter).toHaveValue('OldPass123');

      // Final cleanup to ensure all state updates complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });
  });
});
