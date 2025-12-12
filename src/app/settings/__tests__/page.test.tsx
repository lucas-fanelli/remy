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
jest.mock('@/contexts/PwaContext', () => ({
  usePwa: () => ({
    isInstalled: false,
    isStandalone: false,
    canInstall: false,
    isIOS: false,
    showIOSInstructions: false,
    promptInstall: jest.fn(),
    setShowIOSInstructions: jest.fn(),
    platform: 'unknown',
  }),
}));
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
    isVerified: false,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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

    it('should render privacy & security section', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
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
  });
});
