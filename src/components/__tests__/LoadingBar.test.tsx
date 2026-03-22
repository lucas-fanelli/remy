import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import LoadingBar from '../LoadingBar';

// Mock next/navigation
const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe('LoadingBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should show loading bar when pathname changes', async () => {
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { rerender } = render(<LoadingBar />);

    // No loading bar on initial mount (pathname hasn't changed from ref)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    // Change pathname to trigger loading
    mockUsePathname.mockReturnValue('/recipes');
    rerender(<LoadingBar />);

    // Loading bar should appear after pathname change
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should hide loading bar after timeout', async () => {
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { rerender } = render(<LoadingBar />);

    // Change pathname to trigger loading
    mockUsePathname.mockReturnValue('/recipes');
    rerender(<LoadingBar />);

    // Loading bar should be visible
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Fast-forward timer
    jest.advanceTimersByTime(500);

    // Wait for loading bar to disappear
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('should show loading bar when pathname changes with search params', async () => {
    mockUsePathname.mockReturnValue('/search');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { rerender } = render(<LoadingBar />);

    // No loading bar on initial mount (pathname hasn't changed from ref)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    // Change pathname (the component only triggers on pathname changes)
    mockUsePathname.mockReturnValue('/search/results');
    mockUseSearchParams.mockReturnValue(new URLSearchParams('q=pasta'));
    rerender(<LoadingBar />);

    // Loading bar should appear after pathname change
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should clear timeout on unmount', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { rerender, unmount } = render(<LoadingBar />);

    // Change pathname to trigger loading
    mockUsePathname.mockReturnValue('/recipes');
    rerender(<LoadingBar />);

    // Unmount before timeout completes
    unmount();

    // Timer should be cleared (no errors should occur)
    expect(() => jest.advanceTimersByTime(500)).not.toThrow();
  });

  it('should render nothing when not loading', async () => {
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    const { container } = render(<LoadingBar />);

    // Fast-forward past initial loading
    jest.advanceTimersByTime(500);

    // Wait for component to update
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
