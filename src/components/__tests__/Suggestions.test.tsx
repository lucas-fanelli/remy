import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Suggestions from '../Suggestions';

// Mock AuthContext
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
}));

// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({
    children,
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    ...props
  }: any) => <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children, mode }: any) => <>{children}</>,
  };
});

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

describe('Suggestions Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();

    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it('should render user profile section', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('your_username')).toBeInTheDocument();
    expect(screen.getByText('Your Name')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('should render suggestions header', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('Suggestions For You')).toBeInTheDocument();
    expect(screen.getByText('See All')).toBeInTheDocument();
  });

  it('should render all suggestion items', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('sarah_designs')).toBeInTheDocument();
    expect(screen.getByText('alex_photos')).toBeInTheDocument();
    expect(screen.getByText('mike_codes')).toBeInTheDocument();
    expect(screen.getByText('emma_art')).toBeInTheDocument();
    expect(screen.getByText('david_music')).toBeInTheDocument();
  });

  it('should render suggestion subtitles', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('Followed by user1 + 2 more')).toBeInTheDocument();
    expect(screen.getByText('New to Recipe Sharing')).toBeInTheDocument();
  });

  it('should render follow buttons for each suggestion', () => {
    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    expect(followButtons).toHaveLength(5);
  });

  it('should render footer with links and copyright', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText(/About · Help · Press/)).toBeInTheDocument();
    expect(screen.getByText('© 2025 RECIPE SHARING APP')).toBeInTheDocument();
  });

  it('should not call API when follow button clicked without token', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]);

    // Should not make any API calls
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle follow button click successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]); // Click on first Follow button

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/sarah_designs/follow',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    // Button should show Following after successful follow
    await waitFor(() => {
      expect(screen.getByText('Following')).toBeInTheDocument();
    });
  });

  it('should handle unfollow button click successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]); // Follow first

    await waitFor(() => {
      expect(screen.getByText('Following')).toBeInTheDocument();
    });

    // Now unfollow
    mockFetch.mockResolvedValueOnce({ ok: true });
    const followingButton = screen.getByText('Following');
    fireEvent.click(followingButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/sarah_designs/unfollow',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('should revert follow state on API error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({ ok: false });

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]);

    await waitFor(() => {
      // Should still show Follow after error
      expect(screen.getAllByText('Follow').length).toBe(5);
    });

    consoleErrorSpy.mockRestore();
  });

  it('should revert follow state on network error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]);

    await waitFor(() => {
      // Should still show Follow after error
      expect(screen.getAllByText('Follow').length).toBe(5);
    });

    consoleErrorSpy.mockRestore();
  });

  it('should show loading state when following', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    fireEvent.click(followButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });
});
