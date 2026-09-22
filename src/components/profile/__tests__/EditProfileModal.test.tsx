import { QueryClient, useQuery } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
import { queryWrapper, testQueryClient } from '@/__tests__/helpers/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/hooks/useNotificationPolling';
import { queryKeys } from '@/lib/query/keys';
import EditProfileModal from '../EditProfileModal';

// Speed up waitFor operations (500ms instead of default 1000ms)
configure({ asyncUtilTimeout: 100 });

/**
 * Every render inside a QueryClient: a save that changes privacy tells the cache the
 * owner's profile is stale. `client` is the one a test wants to look into afterwards.
 */
let client: QueryClient;
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: queryWrapper(client) });

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
    client = testQueryClient();

    mockShowSuccess = jest.fn();
    mockShowError = jest.fn();
    mockOnClose = jest.fn();
    mockOnSuccess = jest.fn();
    mockUpdateProfile = jest.fn();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: null,
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
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, 'New Name');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'New Name',
          })
        );
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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('Update failed'));

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
      mockUpdateProfile.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 100))
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

  /** The signed-in owner, private or public, and nothing else changed. */
  function signInAs(isPrivate: boolean) {
    mockUseAuth.mockReturnValue({
      user: { ...mockUser, isPrivate },
      token: null,
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: mockUpdateProfile,
    });
  }

  function openAs(isPrivate: boolean) {
    signInAs(isPrivate);
    render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);
  }

  // Going public accepts every pending follow request, which cannot be undone, so no save
  // may do it by accident: privacy is sent only when the switch was flipped in this form.
  describe('Privacy in the saved payload', () => {
    async function savedPayload(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /save changes/i }));
      await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
      return mockUpdateProfile.mock.calls[0][0];
    }

    it('leaves it out of a bio edit in a tab whose copy of the account says public', async () => {
      // The stale second tab: another tab made the account private since this one loaded.
      // Sending this tab's "public" would make it public again and accept every request.
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(false);

      const bio = screen.getByLabelText(/bio/i);
      await user.clear(bio);
      await user.type(bio, 'Nueva bio');
      const payload = await savedPayload(user);

      expect(payload).toMatchObject({ bio: 'Nueva bio' });
      expect(payload).not.toHaveProperty('isPrivate');
    });

    it('leaves it out of a private account saved without touching the switch', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(true);

      const payload = await savedPayload(user);

      expect(payload).not.toHaveProperty('isPrivate');
    });

    it.each([
      ['on', false, true],
      ['off', true, false],
    ])('sends the switch when it was turned %s', async (_, wasPrivate, isPrivate) => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(wasPrivate);

      await user.click(screen.getByRole('checkbox'));
      const payload = await savedPayload(user);

      expect(payload).toHaveProperty('isPrivate', isPrivate);
    });

    it('leaves it out when the switch was flipped and flipped back', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(true);

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('checkbox'));
      const payload = await savedPayload(user);

      expect(payload).not.toHaveProperty('isPrivate');
    });
  });

  // The same save that makes an account public accepts every request waiting on it, and
  // nothing undoes that. The owner has to be told before they press Save, not after.
  describe('The note on making a private account public', () => {
    const NOTE = 'Making your account public accepts every pending request.';

    it('says, beside the switch, that going public accepts every pending request', async () => {
      const user = userEvent.setup({ delay: null });
      openAs(true);
      const privacy = screen.getByRole('checkbox');

      // Not while the account stays private: there is nothing to warn about yet.
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
      expect(privacy).not.toHaveAccessibleDescription();

      await user.click(privacy);

      expect(screen.getByText(NOTE)).toBeVisible();
      // A screen reader hears it with the switch itself, not only if it reads on.
      expect(privacy).toHaveAccessibleDescription(NOTE);
    });

    it('is announced when it appears, from a live region that was there before it', async () => {
      // A live region inserted together with its text is not announced, and focus stays on
      // the switch while the note appears below it.
      const user = userEvent.setup({ delay: null });
      openAs(true);
      const region = document.querySelector('[aria-live="polite"]');
      expect(region).toBeEmptyDOMElement();

      await user.click(screen.getByRole('checkbox'));

      expect(region).toHaveTextContent(NOTE);
    });

    it('goes away when the switch is turned back on', async () => {
      const user = userEvent.setup({ delay: null });
      openAs(true);

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('checkbox'));

      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toHaveAccessibleDescription();
    });

    it('says nothing to a public account, whichever way its switch goes', async () => {
      // A public account has no requests waiting: turning it private and back is not
      // "making it public" in the sense the note warns about.
      const user = userEvent.setup({ delay: null });
      openAs(false);

      await user.click(screen.getByRole('checkbox'));
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();

      await user.click(screen.getByRole('checkbox'));
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    });
  });

  // What a privacy change moved happened on the server — requests turned into followers,
  // notifications rewritten — and nothing on this screen shows it. The modal says so.
  describe('After a save that changed privacy', () => {
    // The poller's own constant, not the string: the modal spells the name itself, and this
    // is what holds the two spellings together.
    const REFRESH = NOTIFICATIONS_REFRESH_EVENT;
    const own = queryKeys.profile('testuser');
    const someoneElse = queryKeys.profile('ana');
    const inbox = queryKeys.followRequestInbox(mockUser.id);
    let refreshes: jest.Mock;

    beforeEach(() => {
      refreshes = jest.fn();
      window.addEventListener(REFRESH, refreshes);
      client.setQueryData(own, { cached: 'own' });
      client.setQueryData(someoneElse, { cached: 'ana' });
      client.setQueryData(inbox, { cached: 'inbox' });
    });

    afterEach(() => {
      window.removeEventListener(REFRESH, refreshes);
    });

    const isStale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

    async function flipAndSave(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /save changes/i }));
    }

    it.each([
      ['public, which accepted every pending request', true],
      ['private', false],
    ])(
      'refreshes the notifications and the owner’s profile after going %s',
      async (_, wasPrivate) => {
        const user = userEvent.setup({ delay: null });
        mockUpdateProfile.mockResolvedValueOnce(undefined);
        openAs(wasPrivate);

        await flipAndSave(user);
        await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

        expect(refreshes).toHaveBeenCalledTimes(1);
        expect(isStale(own)).toBe(true);
        // Only the owner's: nobody else's profile changed.
        expect(isStale(someoneElse)).toBe(false);
      }
    );

    it('marks the requests inbox stale after going public', async () => {
      // Going public answered every request at once; going private answers none.
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(true);

      await flipAndSave(user);
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

      expect(isStale(inbox)).toBe(true);
    });

    it('leaves the requests inbox alone after going private', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(false);

      await flipAndSave(user);
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

      expect(isStale(inbox)).toBe(false);
    });

    it('leaves both alone after a save that did not touch privacy', async () => {
      // A bio edit: the page's own refetch covers it, and the notifications did not move.
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      openAs(true);

      await user.type(screen.getByLabelText(/bio/i), '!');
      await user.click(screen.getByRole('button', { name: /save changes/i }));
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

      expect(refreshes).not.toHaveBeenCalled();
      expect(isStale(own)).toBe(false);
      expect(isStale(inbox)).toBe(false);
    });

    it('leaves both alone when the save fails', async () => {
      // Nothing was accepted, so there is nothing to go and fetch.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('Update failed'));
      openAs(true);

      await flipAndSave(user);
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Update failed'));

      expect(refreshes).not.toHaveBeenCalled();
      expect(isStale(own)).toBe(false);
      expect(isStale(inbox)).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('joins the profile page’s own refetch instead of aborting it and asking again', async () => {
      // The profile page refetches the profile on screen from its onSuccess. Marking the
      // same query stale must not cancel that request only to send an identical one.
      const signals: AbortSignal[] = [];
      function ProfilePageLike() {
        const profile = useQuery({
          queryKey: own,
          queryFn: ({ signal }) => {
            signals.push(signal);
            return new Promise((resolve) => setTimeout(() => resolve({ fetched: true }), 5));
          },
        });
        return (
          <EditProfileModal
            open={true}
            onClose={mockOnClose}
            onSuccess={() => void profile.refetch()}
          />
        );
      }
      client.removeQueries({ queryKey: own });
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);
      signInAs(true);
      render(<ProfilePageLike />);
      await waitFor(() => expect(client.getQueryData(own)).toEqual({ fetched: true }));

      await flipAndSave(user);
      await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
      await waitFor(() => expect(client.getQueryState(own)?.fetchStatus).toBe('idle'));

      // The first load, then the page's refetch — and that one was allowed to finish.
      expect(signals).toHaveLength(2);
      expect(signals.map((s) => s.aborted)).toEqual([false, false]);
      expect(refreshes).toHaveBeenCalledTimes(1);
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

      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
        'avatar.png',
        { type: 'image/png' }
      );
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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
        'avatar.png',
        { type: 'image/png' }
      );
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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
        'avatar.png',
        { type: 'image/png' }
      );
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
        // Wait for async magic byte validation + FileReader to complete
        await waitFor(() => {
          expect(screen.getByText(/new photo selected/i)).toBeInTheDocument();
        });
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

      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
        'avatar.png',
        { type: 'image/png' }
      );
      const input = document.querySelector('#avatar-upload-modal') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
        await waitFor(() => {
          expect(screen.getByText(/new photo selected/i)).toBeInTheDocument();
        });
      }

      // Mock successful avatar upload (still uses fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/new-avatar.jpg' }),
      });

      // Profile update now uses updateProfile from useAuth
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/upload/avatar',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar: 'https://example.com/new-avatar.jpg',
          })
        );
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
        token: null,
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
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, '   '); // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: null,
          })
        );
      });
    });

    it('should trim whitespace from bio and send null if empty - line 140', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, '   '); // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            bio: null,
          })
        );
      });
    });

    it('should trim whitespace from website and send null if empty - line 141', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const websiteInput = screen.getByLabelText(/website/i);
      await user.clear(websiteInput);
      await user.type(websiteInput, '   '); // Only whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            website: null,
          })
        );
      });
    });

    it('should preserve trimmed non-empty values', async () => {
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const fullNameInput = screen.getByLabelText(/full name/i);
      await user.clear(fullNameInput);
      await user.type(fullNameInput, '  John Doe  '); // With surrounding whitespace

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'John Doe',
          })
        );
      });
    });
  });

  describe('Error Handling - Lines 150-161', () => {
    it('should throw Error with custom message when response not ok - line 150', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('Custom error message'));

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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      // Rejecting with a non-Error triggers the fallback message path
      mockUpdateProfile.mockRejectedValueOnce('unknown failure');

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to update profile');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions - line 161', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      mockUpdateProfile.mockRejectedValueOnce('String error'); // Non-Error exception

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to update profile');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console on update failure - line 160', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      const testError = new Error('Network error');
      mockUpdateProfile.mockRejectedValueOnce(testError);

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
        token: null,
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
        token: null,
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
        token: null,
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
        token: null,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateProfile: mockUpdateProfile,
      });

      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar: null,
          })
        );
      });
    });
  });

  describe('Mobile Viewport - lines 178-342', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      // Mock mobile viewport (width < 600px triggers sm breakpoint)
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query.includes('max-width') || query.includes('(max-width:599.95px)'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('should render in mobile mode with fullScreen dialog - lines 178-224', async () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Modal should be visible
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
    });

    it('should render mobile-sized form fields - lines 250-332', async () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    });

    it('should render mobile-sized buttons - lines 335-342', async () => {
      render(<EditProfileModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const saveButton = screen.getByRole('button', { name: /save changes/i });

      expect(cancelButton).toBeInTheDocument();
      expect(saveButton).toBeInTheDocument();
    });
  });
});
