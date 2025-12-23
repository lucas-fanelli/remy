import { render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import LayoutWrapper from '../LayoutWrapper';

// Mock next/navigation
const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock Navigation component
jest.mock('../Navigation', () => {
  return function MockNavigation() {
    return <div data-testid="navigation">Navigation</div>;
  };
});

// Mock LoadingBar component
jest.mock('../LoadingBar', () => {
  return function MockLoadingBar() {
    return null;
  };
});

// Mock Footer component
jest.mock('../Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer">Footer</div>;
  };
});

describe('LayoutWrapper Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children', () => {
    mockUsePathname.mockReturnValue('/');

    render(
      <LayoutWrapper>
        <div>Test Content</div>
      </LayoutWrapper>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should show navigation on home page', () => {
    mockUsePathname.mockReturnValue('/');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });

  it('should hide navigation on /auth page', () => {
    mockUsePathname.mockReturnValue('/auth');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.queryByTestId('navigation')).not.toBeInTheDocument();
  });

  it('should hide navigation on /login page', () => {
    mockUsePathname.mockReturnValue('/login');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.queryByTestId('navigation')).not.toBeInTheDocument();
  });

  it('should hide navigation on /register page', () => {
    mockUsePathname.mockReturnValue('/register');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.queryByTestId('navigation')).not.toBeInTheDocument();
  });

  it('should show navigation on other pages like /pantry', () => {
    mockUsePathname.mockReturnValue('/pantry');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });

  it('should show navigation on recipe detail pages', () => {
    mockUsePathname.mockReturnValue('/recipe/123');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });

  it('should show navigation on profile pages', () => {
    mockUsePathname.mockReturnValue('/profile/testuser');

    render(
      <LayoutWrapper>
        <div>Content</div>
      </LayoutWrapper>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
  });
});
