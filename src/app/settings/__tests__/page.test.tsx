import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SettingsPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ToastContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock framer-motion
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  return {
    motion: mockMotion,
  };
});

// Mock ChangePasswordDialog component
jest.mock('@/components/settings/ChangePasswordDialog', () => {
  return function MockChangePasswordDialog({ open, onClose }: any) {
    return open ? (
      <div data-testid="change-password-dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseThemeMode = useThemeMode as jest.MockedFunction<typeof useThemeMode>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// Create stable mock functions outside describe block
const mockPush = jest.fn();
const mockToggleTheme = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowInfo = jest.fn();

const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

describe('SettingsPage', () => {
  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    bio: 'Test bio',
    avatar: '/avatar.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue(mockRouter as any);

    mockUseToast.mockReturnValue({
      showToast: jest.fn(),
      showSuccess: mockShowSuccess,
      showError: jest.fn(),
      showWarning: jest.fn(),
      showInfo: mockShowInfo,
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
    });

    mockUseThemeMode.mockReturnValue({
      mode: 'light',
      toggleTheme: mockToggleTheme,
    });
  });

  describe('Authentication', () => {
    it('should redirect to /auth if user is not logged in', () => {
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

      render(<SettingsPage />);

      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('should render nothing when user is null', () => {
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

      const { container } = render(<SettingsPage />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Page Rendering', () => {
    it('should render settings page with title', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Manage your account preferences and settings')).toBeInTheDocument();
    });

    it('should render appearance section', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    it('should render language section', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Language & Region')).toBeInTheDocument();
    });

    it('should render notifications section', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText('Marketing Emails')).toBeInTheDocument();
    });

    it('should render privacy & security section', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
      expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
    });

    it('should render info alert', () => {
      render(<SettingsPage />);

      expect(screen.getByText(/These are basic settings for V1/i)).toBeInTheDocument();
    });
  });

  describe('Dark Mode Toggle', () => {
    it('should show dark mode switch as unchecked when in light mode', () => {
      render(<SettingsPage />);

      const darkModeSwitch = screen.getByRole('checkbox', { name: /dark mode/i });
      expect(darkModeSwitch).not.toBeChecked();
    });

    it('should show dark mode switch as checked when in dark mode', () => {
      mockUseThemeMode.mockReturnValue({
        mode: 'dark',
        toggleTheme: mockToggleTheme,
      });

      render(<SettingsPage />);

      const darkModeSwitch = screen.getByRole('checkbox', { name: /dark mode/i });
      expect(darkModeSwitch).toBeChecked();
    });

    it('should toggle theme when dark mode switch is clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const darkModeSwitch = screen.getByRole('checkbox', { name: /dark mode/i });
      await user.click(darkModeSwitch);

      expect(mockToggleTheme).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith('Switched to dark mode');
    });
  });

  describe('Language Settings', () => {
    it('should have English selected by default', () => {
      render(<SettingsPage />);

      // Check that Language label exists
      const languageLabels = screen.getAllByText('Language');
      expect(languageLabels.length).toBeGreaterThan(0);

      // MUI Select renders the selected value as text - English should be visible
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should show success toast when language is changed', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // Find the Select component by its role
      const languageSelect = screen.getByRole('combobox', { hidden: true });
      await user.click(languageSelect);

      // Wait for menu to open and click Spanish option
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
      });

      const spanishOption = screen.getByRole('option', { name: 'Español' });
      await user.click(spanishOption);

      expect(mockShowSuccess).toHaveBeenCalledWith('Language preference saved');
    });
  });

  describe('Notification Settings', () => {
    it('should have email notifications enabled by default', () => {
      render(<SettingsPage />);

      const emailSwitch = screen.getByRole('checkbox', { name: /email notifications/i });
      expect(emailSwitch).toBeChecked();
    });

    it('should have push notifications disabled by default', () => {
      render(<SettingsPage />);

      const pushSwitch = screen.getByRole('checkbox', { name: /push notifications/i });
      expect(pushSwitch).not.toBeChecked();
    });

    it('should have marketing emails disabled by default', () => {
      render(<SettingsPage />);

      const marketingSwitch = screen.getByRole('checkbox', { name: /marketing emails/i });
      expect(marketingSwitch).not.toBeChecked();
    });

    it('should toggle email notifications', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const emailSwitch = screen.getByRole('checkbox', { name: /email notifications/i });
      expect(emailSwitch).toBeChecked();

      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();
    });

    it('should toggle push notifications', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const pushSwitch = screen.getByRole('checkbox', { name: /push notifications/i });
      expect(pushSwitch).not.toBeChecked();

      await user.click(pushSwitch);
      expect(pushSwitch).toBeChecked();
    });

    it('should toggle marketing emails', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const marketingSwitch = screen.getByRole('checkbox', { name: /marketing emails/i });
      expect(marketingSwitch).not.toBeChecked();

      await user.click(marketingSwitch);
      expect(marketingSwitch).toBeChecked();
    });
  });

  describe('Privacy & Security', () => {
    it('should open change password dialog when clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const changePasswordButton = screen.getByText('Change Password');
      await user.click(changePasswordButton);

      expect(screen.getByTestId('change-password-dialog')).toBeInTheDocument();
    });

    it('should close change password dialog', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const changePasswordButton = screen.getByText('Change Password');
      await user.click(changePasswordButton);

      expect(screen.getByTestId('change-password-dialog')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      expect(screen.queryByTestId('change-password-dialog')).not.toBeInTheDocument();
    });

    it('should show info toast when cookie preferences is clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const cookieButton = screen.getByText('Cookie Preferences');
      await user.click(cookieButton);

      expect(mockShowInfo).toHaveBeenCalledWith('Cookie settings coming soon');
    });
  });
});
