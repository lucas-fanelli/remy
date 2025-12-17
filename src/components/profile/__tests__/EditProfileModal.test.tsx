import React from 'react';
import { render, screen, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EditProfileModal from '../EditProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

// Speed up waitFor operations (500ms instead of default 1000ms)
configure({ asyncUtilTimeout: 100 });

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ToastContext');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('EditProfileModal', () => {
  let mockShowSuccess: jest.Mock;
  let mockShowError: jest.Mock;
  let mockOnClose: jest.Mock;
  let mockOnSuccess: jest.Mock;
  let mockUpdateProfile: jest.Mock;
  let mockFetch: jest.Mock;

  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    bio: 'Test bio',
    website: 'https://example.com',
    avatar: '/avatar.jpg',
    role: 'USER' as const,
    isPrivate: false,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockShowSuccess = jest.fn();
    mockShowError = jest.fn();
    mockOnClose = jest.fn();
    mockOnSuccess = jest.fn();
    mockUpdateProfile = jest.fn();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: mockUpdateProfile,
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
    it('should not render when open is false', () => {
      render(<EditProfileModal open={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    it('should show disabled username and email fields', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const usernameInput = screen.getByDisplayValue('testuser');
      const emailInput = screen.getByDisplayValue('test@example.com');

      expect(usernameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
    });

    it('should show avatar', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const avatars = document.querySelectorAll('.MuiAvatar-root');
      expect(avatars.length).toBeGreaterThan(0);
    });

    it('should render change photo button', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Change Photo')).toBeInTheDocument();
    });

    it('should render private account switch', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Private Account')).toBeInTheDocument();
      const switchElement = screen.getByRole('checkbox');
      expect(switchElement).not.toBeChecked();
    });
  });

  describe('Form Input', () => {
    it('should update full name field', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, 'New Name');

      expect(fullNameInput).toHaveValue('New Name');
    });

    it('should update bio field', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, 'New bio');

      expect(bioInput).toHaveValue('New bio');
    });

    it('should update website field', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const websiteInput = screen.getByLabelText(/website/i);
      await user.clear(websiteInput);
      await user.type(websiteInput, 'https://newsite.com');

      expect(websiteInput).toHaveValue('https://newsite.com');
    });

    it('should toggle private account switch', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const switchElement = screen.getByRole('checkbox');
      expect(switchElement).not.toBeChecked();

      await user.click(switchElement);
      expect(switchElement).toBeChecked();
    });

    it('should show character count for bio', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('8/300 characters')).toBeInTheDocument();
    });

    it('should limit bio to 300 characters', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const bioInput = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;
      await user.clear(bioInput);

      const longText = 'a'.repeat(350);
      // Use paste instead of type for better performance with long text
      await user.click(bioInput);
      await user.paste(longText);

      expect(bioInput.value.length).toBeLessThanOrEqual(300);
    });
  });

  describe('Form Submission', () => {
    it('should successfully update profile', async () => {
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockUser, fullName: 'New Name' } }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, 'New Name');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: expect.stringContaining('New Name'),
        });
      });

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Profile updated successfully!');
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error when not authenticated', async () => {
      const user = userEvent.setup({ delay: null });
      mockUseAuth.mockReturnValue({
        user: { ...mockUser },
        token: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockShowError).toHaveBeenCalledWith('You must be logged in to update your profile');
    });

    it('should show error when API request fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Update failed');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should disable buttons while saving', async () => {
      const user = userEvent.setup({ delay: null });
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

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close icon is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        await user.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('Avatar Upload', () => {
    it('should handle avatar file selection', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);

        await waitFor(() => {
          expect(
            screen.getByText('New photo selected - will be uploaded when you save')
          ).toBeInTheDocument();
        });
      }
    });

    it('should handle avatar upload error - non-ok response', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);

        await waitFor(() => {
          expect(
            screen.getByText('New photo selected - will be uploaded when you save')
          ).toBeInTheDocument();
        });
      }

      // Mock failed avatar upload (line 117-120)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File too large' }),
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('File too large');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle avatar upload error - without specific error message', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
      }

      // Mock failed avatar upload without error field (line 119 - fallback message)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to upload avatar');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should successfully upload avatar and update profile', async () => {
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
      }

      // Mock successful avatar upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/new-avatar.jpg' }),
      });

      // Mock successful profile update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { ...mockUser, avatar: 'https://example.com/new-avatar.jpg' },
        }),
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/upload/avatar', expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        }));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('https://example.com/new-avatar.jpg'),
        }));
      });

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Profile updated successfully!');
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('User Data', () => {
    it('should not render when user is null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: jest.fn(),
      });

      const { container } = render(
        <EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should populate form with user data when opened', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });

    it('should handle user with null/undefined optional fields', () => {
      const userWithNulls = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        fullName: null,
        bio: null,
        website: null,
        avatar: null,
        role: 'USER' as const,
        isPrivate: false,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: userWithNulls,
        token: 'mock-token',
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: jest.fn(),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Should render with empty strings for null values
      const fullNameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
      const bioInput = screen.getByLabelText(/bio/i) as HTMLTextAreaElement;
      const websiteInput = screen.getByLabelText(/website/i) as HTMLInputElement;

      expect(fullNameInput.value).toBe('');
      expect(bioInput.value).toBe('');
      expect(websiteInput.value).toBe('');
    });
  });

  describe('Whitespace Handling - Lines 139-141', () => {
    it('should trim whitespace from fullName and send null if empty - line 139', async () => {
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, '   ');  // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          body: expect.stringContaining('"fullName":null'),
        }));
      });
    });

    it('should trim whitespace from bio and send null if empty - line 140', async () => {
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, '   ');  // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          body: expect.stringContaining('"bio":null'),
        }));
      });
    });

    it('should trim whitespace from website and send null if empty - line 141', async () => {
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const websiteInput = screen.getByLabelText(/website/i);
      await user.clear(websiteInput);
      await user.type(websiteInput, '   ');  // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          body: expect.stringContaining('"website":null'),
        }));
      });
    });

    it('should preserve trimmed non-empty values', async () => {
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, '  John Doe  ');  // With surrounding whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          body: expect.stringContaining('"fullName":"John Doe"'),
        }));
      });
    });
  });

  describe('Error Handling - Lines 150-161', () => {
    it('should throw Error with custom message when response not ok - line 150', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Custom error message' }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating profile:', expect.any(Error));
        expect(mockShowError).toHaveBeenCalledWith('Custom error message');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should throw Error with fallback message when error field missing - line 150', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to update profile');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions - line 161', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      mockFetch.mockRejectedValueOnce('String error');  // Non-Error exception

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to update profile');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console on update failure - line 160', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const user = userEvent.setup({ delay: null });
      const testError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(testError);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating profile:', testError);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('UI Rendering - Lines 178-332', () => {
    it('should render username helper text - line 252', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Username cannot be changed')).toBeInTheDocument();
    });

    it('should render email helper text - line 262', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Email cannot be changed')).toBeInTheDocument();
    });

    it('should render fullName placeholder - line 273', () => {
      const userWithNoName = {
        ...mockUser,
        fullName: '',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUseAuth.mockReturnValue({
        user: userWithNoName,
        token: 'mock-token',
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument();
    });

    it('should render bio placeholder and helper text - lines 286-287', () => {
      const userWithNoBio = {
        ...mockUser,
        bio: '',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUseAuth.mockReturnValue({
        user: userWithNoBio,
        token: 'mock-token',
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByPlaceholderText('Tell us about yourself...')).toBeInTheDocument();
      expect(screen.getByText('0/300 characters')).toBeInTheDocument();
    });

    it('should render website placeholder - line 299', () => {
      const userWithNoWebsite = {
        ...mockUser,
        website: '',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUseAuth.mockReturnValue({
        user: userWithNoWebsite,
        token: 'mock-token',
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByPlaceholderText('https://yourwebsite.com')).toBeInTheDocument();
    });

    it('should render private account description - lines 314-316', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Only approved followers can see your recipes')).toBeInTheDocument();
    });

    it('should render Cancel and Save buttons with correct props - lines 328-342', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const saveButton = screen.getByRole('button', { name: /save changes/i });

      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).not.toBeDisabled();

      expect(saveButton).toBeInTheDocument();
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Avatar Handling - Line 107', () => {
    it('should use user avatar when available', () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const avatar = document.querySelector('.MuiAvatar-root img') as HTMLImageElement;
      expect(avatar).toBeInTheDocument();
      expect(avatar.src).toContain('avatar.jpg');
    });

    it('should use null when user has no avatar - line 107', async () => {
      const user = userEvent.setup({ delay: null });
      const userWithNoAvatar = {
        ...mockUser,
        avatar: null,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUseAuth.mockReturnValue({
        user: userWithNoAvatar,
        token: 'mock-token',
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
          body: expect.stringContaining('"avatar":null'),
        }));
      });
    });
  });
});
