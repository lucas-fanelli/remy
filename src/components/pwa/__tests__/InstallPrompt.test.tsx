import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import InstallPrompt from '../InstallPrompt';

// Mock PwaContext
const mockTriggerInstall = jest.fn();
const mockDismissInstallPrompt = jest.fn();

jest.mock('@/contexts/PwaContext', () => ({
  usePwa: jest.fn(),
}));

import { usePwa } from '@/contexts/PwaContext';
const mockUsePwa = usePwa as jest.MockedFunction<typeof usePwa>;

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('InstallPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock - not showing prompt
    mockUsePwa.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      isRunningStandalone: false,
      isIOSSafari: false,
      isDesktopChrome: false,
      showInstallPrompt: false,
      promptAvailable: false,
      triggerInstall: mockTriggerInstall,
      dismissInstallPrompt: mockDismissInstallPrompt,
      openApp: jest.fn(),
      resetDismissal: jest.fn(),
    });
  });

  describe('Visibility', () => {
    it('should return null when showInstallPrompt is false', () => {
      const { container } = renderWithProviders(<InstallPrompt />);

      expect(container.firstChild).toBeNull();
    });

    it('should render drawer when showInstallPrompt is true', () => {
      mockUsePwa.mockReturnValue({
        canInstall: true,
        isInstalled: false,
        isRunningStandalone: false,
        isIOSSafari: false,
        isDesktopChrome: true,
        showInstallPrompt: true,
        promptAvailable: true,
        triggerInstall: mockTriggerInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        openApp: jest.fn(),
        resetDismissal: jest.fn(),
      });

      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText('Get the Full Experience')).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    beforeEach(() => {
      mockUsePwa.mockReturnValue({
        canInstall: true,
        isInstalled: false,
        isRunningStandalone: false,
        isIOSSafari: false,
        isDesktopChrome: true,
        showInstallPrompt: true,
        promptAvailable: true,
        triggerInstall: mockTriggerInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        openApp: jest.fn(),
        resetDismissal: jest.fn(),
      });
    });

    it('should render title', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText('Get the Full Experience')).toBeInTheDocument();
    });

    it('should render description', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText(/Install Remy's on your home screen/i)).toBeInTheDocument();
    });

    it('should render close button with aria-label', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByLabelText('Close install prompt')).toBeInTheDocument();
    });
  });

  describe('Standard Install (Non-iOS)', () => {
    beforeEach(() => {
      mockUsePwa.mockReturnValue({
        canInstall: true,
        isInstalled: false,
        isRunningStandalone: false,
        isIOSSafari: false,
        isDesktopChrome: true,
        showInstallPrompt: true,
        promptAvailable: true,
        triggerInstall: mockTriggerInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        openApp: jest.fn(),
        resetDismissal: jest.fn(),
      });
    });

    it('should render Install App button', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
    });

    it('should render Not now button', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
    });

    it('should call triggerInstall when Install App is clicked', () => {
      renderWithProviders(<InstallPrompt />);

      fireEvent.click(screen.getByRole('button', { name: /install app/i }));

      expect(mockTriggerInstall).toHaveBeenCalledTimes(1);
    });

    it('should call dismissInstallPrompt when Not now is clicked', () => {
      renderWithProviders(<InstallPrompt />);

      fireEvent.click(screen.getByRole('button', { name: /not now/i }));

      expect(mockDismissInstallPrompt).toHaveBeenCalledTimes(1);
    });

    it('should call dismissInstallPrompt when close button is clicked', () => {
      renderWithProviders(<InstallPrompt />);

      fireEvent.click(screen.getByLabelText('Close install prompt'));

      expect(mockDismissInstallPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('iOS Safari Install', () => {
    beforeEach(() => {
      mockUsePwa.mockReturnValue({
        canInstall: true,
        isInstalled: false,
        isRunningStandalone: false,
        isIOSSafari: true,
        isDesktopChrome: false,
        showInstallPrompt: true,
        promptAvailable: false,
        triggerInstall: mockTriggerInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        openApp: jest.fn(),
        resetDismissal: jest.fn(),
      });
    });

    it('should show iOS instructions instead of install button', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText(/To install on your device/i)).toBeInTheDocument();
    });

    it('should show Share button instruction', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText(/Tap the/i)).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('should show Add to Home Screen instruction', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
    });

    it('should show Got it button for iOS', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
    });

    it('should not show Not now button for iOS', () => {
      renderWithProviders(<InstallPrompt />);

      expect(screen.queryByRole('button', { name: /not now/i })).not.toBeInTheDocument();
    });

    it('should call dismissInstallPrompt when Got it is clicked', () => {
      renderWithProviders(<InstallPrompt />);

      fireEvent.click(screen.getByRole('button', { name: /got it/i }));

      expect(mockDismissInstallPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('Drawer Behavior', () => {
    it('should render as bottom drawer', () => {
      mockUsePwa.mockReturnValue({
        canInstall: true,
        isInstalled: false,
        isRunningStandalone: false,
        isIOSSafari: false,
        isDesktopChrome: true,
        showInstallPrompt: true,
        promptAvailable: true,
        triggerInstall: mockTriggerInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        openApp: jest.fn(),
        resetDismissal: jest.fn(),
      });

      renderWithProviders(<InstallPrompt />);

      // MUI Drawer with anchor="bottom" should be visible
      expect(screen.getByText('Get the Full Experience')).toBeInTheDocument();
    });
  });
});
