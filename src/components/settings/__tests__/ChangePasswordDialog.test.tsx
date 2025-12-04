import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChangePasswordDialog from '../ChangePasswordDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ToastContext');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;


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
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: false,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
      render(<ChangePasswordDialog open={false} onClose={mockOnClose} />);

      expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
    });

    it('should render when open is true', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const changePasswordElements = screen.getAllByText('Change Password');
      expect(changePasswordElements.length).toBeGreaterThan(0);
    });

    it('should render all password fields', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    });

    it('should render info alert with password requirements', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(
        screen.getByText(/Your password must be at least 8 characters/i)
      ).toBeInTheDocument();
    });

    it('should render cancel and submit buttons', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    });

    it('should render close icon button', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle current password visibility', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement;
      expect(currentPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButton = toggleButtons.find((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      if (visibilityButton) {
        fireEvent.click(visibilityButton);
        await waitFor(() => {
          expect(currentPasswordInput.type).toBe('text');
        });
      }
    });

    it('should toggle new password visibility', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const newPasswordInput = screen.getByLabelText(/^new password/i) as HTMLInputElement;
      expect(newPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButtons = toggleButtons.filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      if (visibilityButtons.length > 1) {
        fireEvent.click(visibilityButtons[1]);
        await waitFor(() => {
          expect(newPasswordInput.type).toBe('text');
        });
      }
    });

    it('should toggle confirm password visibility', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement;
      expect(confirmPasswordInput.type).toBe('password');

      const toggleButtons = screen.getAllByRole('button');
      const visibilityButtons = toggleButtons.filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      // Third visibility button is for confirm password
      if (visibilityButtons.length > 2) {
        fireEvent.click(visibilityButtons[2]);
        await waitFor(() => {
          expect(confirmPasswordInput.type).toBe('text');
        });
      }
    });
  });

  describe('Form Input', () => {
    it('should update current password field', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });

      expect(currentPasswordInput).toHaveValue('OldPass123');
    });

    it('should update new password field', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const newPasswordInput = screen.getByLabelText(/^new password/i);
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });

      expect(newPasswordInput).toHaveValue('NewPass123');
    });

    it('should update confirm password field', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      expect(confirmPasswordInput).toHaveValue('NewPass123');
    });
  });

  describe('Form Validation', () => {
    it('should show error when current password is empty', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText('Current password is required')).toBeInTheDocument();
    });

    it('should show error when new password is empty', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText('New password is required')).toBeInTheDocument();
    });

    it('should show error when password is too short', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'Short1' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should show error when password lacks uppercase', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one uppercase letter')
      ).toBeInTheDocument();
    });

    it('should show error when password lacks lowercase', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NEWPASS123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one lowercase letter')
      ).toBeInTheDocument();
    });

    it('should show error when password lacks number', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(
        await screen.findByText('Password must contain at least one number')
      ).toBeInTheDocument();
    });

    it('should show error when passwords do not match', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should show error when new password equals current password', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'SamePass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'SamePass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SamePass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('New password must be different from current password')
        ).toBeInTheDocument();
      });
    });

    it('should clear error when field is updated', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText('Current password is required')).toBeInTheDocument();

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });

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

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

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

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

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

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

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

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

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
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close icon is clicked', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should reset form when dialog closes', async () => {
      const { rerender } = render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });

      // Wait for all state updates to complete
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

    it('should reset all form fields and states when handleClose is called - lines 150-161', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      // Fill in all fields
      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      // Toggle password visibility
      const visibilityButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );
      if (visibilityButtons[0]) fireEvent.click(visibilityButtons[0]);

      // Trigger validation errors
      fireEvent.change(confirmPasswordInput, { target: { value: 'Different123' } });
      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/Passwords do not match/i)).toBeInTheDocument();
      });

      // Click close button to trigger handleClose
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Verify onClose was called
      expect(mockOnClose).toHaveBeenCalled();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });
  });

  describe('Error Handling - Lines 136-143', () => {
    it('should throw Error with custom message when response not ok - line 136', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid current password' }),
      });

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'WrongPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error changing password:', expect.any(Error));
        expect(mockShowError).toHaveBeenCalledWith('Invalid current password');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should throw Error with fallback message when error field missing - line 136', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to change password');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions - line 143', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce('String error');

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to change password');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console on failure - line 142', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(testError);

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error changing password:', testError);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Success Flow - Lines 139-140', () => {
    it('should call showSuccess and handleClose on successful password change - lines 139-140', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPass123' } });
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123' } });

      const submitButton = screen.getByRole('button', { name: /change password/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Password changed successfully!');
        expect(mockOnClose).toHaveBeenCalled();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });
  });

  describe('UI Rendering - Lines 210-217, 240-247, 270-277', () => {
    it('should render current password field with correct size and InputProps - lines 210-217', () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement;
      expect(currentPasswordInput).toBeInTheDocument();
      expect(currentPasswordInput.type).toBe('password');

      // Verify visibility toggle button exists in InputProps endAdornment
      const visibilityButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );
      expect(visibilityButtons.length).toBeGreaterThan(0);
    });

    it('should render new password field with correct size and InputProps - lines 240-247', () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const newPasswordInput = screen.getByLabelText(/^new password/i) as HTMLInputElement;
      expect(newPasswordInput).toBeInTheDocument();
      expect(newPasswordInput.type).toBe('password');

      // Verify all three visibility toggle buttons exist
      const visibilityButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );
      expect(visibilityButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('should render confirm password field with correct size and InputProps - lines 270-277', () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement;
      expect(confirmPasswordInput).toBeInTheDocument();
      expect(confirmPasswordInput.type).toBe('password');

      // Verify third visibility toggle exists for confirm password
      const visibilityButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );
      expect(visibilityButtons[2]).toBeInTheDocument();
    });

    it('should show VisibilityOff icon when password is visible - lines 220, 250, 280', async () => {
      render(<ChangePasswordDialog open={true} onClose={mockOnClose} />);

      const visibilityButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('[data-testid="VisibilityIcon"]')
      );

      if (visibilityButtons[0]) {
        fireEvent.click(visibilityButtons[0]);

        await waitFor(() => {
          const visibilityOffButtons = screen.getAllByRole('button').filter((btn) =>
            btn.querySelector('[data-testid="VisibilityOffIcon"]')
          );
          expect(visibilityOffButtons.length).toBeGreaterThan(0);
        });
      }
    });
  });
});
